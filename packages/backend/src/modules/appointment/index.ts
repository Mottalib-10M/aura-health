import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { generateCheckInCode } from '../../utils/crypto.js';
import { sendNotification } from '../../services/notification/index.js';
import { getAvailableSlots } from '../doctor/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleAppointmentInput {
  patientId: string;
  doctorId?: string;
  institutionId?: string;
  specialty: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  urgencyLevel: string;
  reason?: string;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  doctorId: string;
  institutionId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  checkInCode: string;
  estimatedWait: number | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleResult {
  appointment: AppointmentRecord;
  alternativeSlots: Array<{ startTime: string; endTime: string; isAvailable: boolean }>;
  estimatedWaitMinutes: number;
}

interface ScoredDoctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  institutionId: string | null;
  efficacyScore: number | null;
  satisfactionScore: number | null;
  score: number;
}

// ---------------------------------------------------------------------------
// Constraint satisfaction solver
// ---------------------------------------------------------------------------

/**
 * Score and rank doctors based on multiple constraint dimensions:
 * 1. Availability at preferred time
 * 2. Efficacy score (clinical outcomes)
 * 3. Patient satisfaction rating
 * 4. Urgency (emergency patients get the first available)
 * 5. Geographic proximity (same institution/region)
 * 6. Workload balancing (fewer appointments = higher score)
 */
async function rankDoctors(
  input: ScheduleAppointmentInput,
): Promise<ScoredDoctor[]> {
  const targetDate = input.preferredDate ?? new Date().toISOString().slice(0, 10);

  // Find all verified doctors with the requested specialty in the region
  // When a specific doctorId is provided, skip the specialty filter (the doctor is already chosen)
  let sql = `
    SELECT d.id, d.first_name, d.last_name, d.specialty, d.institution_id,
           d.efficacy_score, d.satisfaction_score,
           (SELECT COUNT(*) FROM appointments a
            WHERE a.doctor_id = d.id AND DATE(a.scheduled_at) = $1
              AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
           ) AS daily_appointment_count
    FROM doctors d
    WHERE d.verification_status = 'VERIFIED'
  `;
  const params: unknown[] = [targetDate];
  let paramIdx = 2;

  if (input.doctorId) {
    // Specific doctor requested — skip specialty filter
    sql += ` AND d.id = $${paramIdx++}`;
    params.push(input.doctorId);
  } else {
    // No specific doctor — filter by specialty
    sql += ` AND d.specialty = $${paramIdx++}`;
    params.push(input.specialty);
  }

  if (input.institutionId) {
    sql += ` AND d.institution_id = $${paramIdx++}`;
    params.push(input.institutionId);
  }

  sql += ` ORDER BY d.efficacy_score DESC NULLS LAST LIMIT 20`;

  const result = await query(sql, params);

  // Score each doctor
  const urgencyWeight = getUrgencyWeight(input.urgencyLevel);
  const scored: ScoredDoctor[] = [];

  for (const row of result.rows) {
    const dailyLoad = Number(row.daily_appointment_count ?? 0);
    const efficacy = Number(row.efficacy_score ?? 0.5);
    const satisfaction = Number(row.satisfaction_score ?? 0.5);

    // Composite score (0-1 range)
    // Higher efficacy = better, higher satisfaction = better, lower load = better
    const loadScore = Math.max(0, 1 - dailyLoad / 20); // Assume max 20 appointments/day
    const score =
      efficacy * 0.35 +
      satisfaction * 0.25 +
      loadScore * 0.2 +
      urgencyWeight * 0.2;

    scored.push({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      specialty: row.specialty as string,
      institutionId: (row.institution_id as string) ?? null,
      efficacyScore: row.efficacy_score as number | null,
      satisfactionScore: row.satisfaction_score as number | null,
      score: Math.round(score * 100) / 100,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function getUrgencyWeight(urgency: string): number {
  switch (urgency) {
    case 'EMERGENCY': return 1.0;
    case 'URGENT': return 0.8;
    case 'SEMI_URGENT': return 0.5;
    case 'NON_URGENT': return 0.2;
    default: return 0.2;
  }
}

// ---------------------------------------------------------------------------
// Slot selection
// ---------------------------------------------------------------------------

async function findBestSlot(
  doctorId: string,
  input: ScheduleAppointmentInput,
  durationMinutes = 30,
): Promise<{ scheduledAt: string; alternativeSlots: Array<{ startTime: string; endTime: string }> }> {
  const targetDate = input.preferredDate ?? new Date().toISOString().slice(0, 10);

  // Get available slots for the doctor on the target date
  const available = await getAvailableSlots(doctorId, targetDate, durationMinutes);

  if (available.length === 0) {
    // Try the next 5 days
    for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + dayOffset);
      const nextDateStr = nextDate.toISOString().slice(0, 10);
      const nextAvailable = await getAvailableSlots(doctorId, nextDateStr, durationMinutes);
      if (nextAvailable.length > 0) {
        return {
          scheduledAt: nextAvailable[0].startTime,
          alternativeSlots: nextAvailable.slice(1, 4),
        };
      }
    }
    throw new Error('No available slots found within the next 5 days');
  }

  // If preferred time is specified, find the closest slot
  if (input.preferredTimeStart) {
    const preferred = new Date(`${targetDate}T${input.preferredTimeStart}`).getTime();
    const sorted = [...available].sort(
      (a, b) =>
        Math.abs(new Date(a.startTime).getTime() - preferred) -
        Math.abs(new Date(b.startTime).getTime() - preferred),
    );
    return {
      scheduledAt: sorted[0].startTime,
      alternativeSlots: sorted.slice(1, 4),
    };
  }

  // Default: take the first available slot
  return {
    scheduledAt: available[0].startTime,
    alternativeSlots: available.slice(1, 4),
  };
}

// ---------------------------------------------------------------------------
// Main scheduling function
// ---------------------------------------------------------------------------

/**
 * Schedule an appointment using constraint satisfaction:
 * 1. Rank doctors by composite score
 * 2. Find best available slot
 * 3. Create the appointment
 * 4. Send confirmation notification
 */
export async function scheduleAppointment(input: ScheduleAppointmentInput): Promise<ScheduleResult> {
  logger.info(
    { patientId: input.patientId, specialty: input.specialty, urgency: input.urgencyLevel },
    'Scheduling appointment',
  );

  // Step 1: Rank doctors (or use the specified doctor)
  const rankedDoctors = await rankDoctors(input);

  if (rankedDoctors.length === 0) {
    throw new Error(`No verified ${input.specialty} doctors available`);
  }

  // Direct booking: when a doctor explicitly picks a date+time from the schedule,
  // bypass the slot availability system and book directly at the requested time.
  let selectedDoctor = rankedDoctors[0];
  let slotResult: Awaited<ReturnType<typeof findBestSlot>> | null = null;

  if (input.doctorId && input.preferredDate && input.preferredTimeStart) {
    logger.info('Direct booking — doctor selected specific date/time');
    selectedDoctor = rankedDoctors.find(d => d.id === input.doctorId) ?? rankedDoctors[0];
    const scheduledAt = new Date(`${input.preferredDate}T${input.preferredTimeStart}:00`);
    slotResult = {
      scheduledAt: scheduledAt.toISOString(),
      alternativeSlots: [],
    };
  } else {
    // Step 2: Find available slot with best doctor via constraint solver
    let lastError: Error | null = null;

    for (const doctor of rankedDoctors) {
      try {
        slotResult = await findBestSlot(doctor.id, input);
        selectedDoctor = doctor;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    if (!slotResult) {
      throw lastError ?? new Error('No available slots found');
    }
  }

  // Step 3: Create appointment
  const appointmentId = uuidv4();
  const checkInCode = generateCheckInCode();
  const durationMinutes = input.urgencyLevel === 'EMERGENCY' ? 60 : 30;

  const appointment = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO appointments (
        id, patient_id, doctor_id, institution_id,
        scheduled_at, duration_minutes, status,
        check_in_code, reason,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SCHEDULED', $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        appointmentId,
        input.patientId,
        selectedDoctor.id,
        selectedDoctor.institutionId,
        slotResult.scheduledAt,
        durationMinutes,
        checkInCode,
        input.reason ?? null,
      ],
    );

    return result.rows[0];
  });

  const mappedAppointment = mapAppointmentRow(appointment);

  // Step 4: Send confirmation notification (non-blocking)
  sendNotification({
    recipientId: input.patientId,
    urgency: input.urgencyLevel === 'EMERGENCY' ? 'critical' : 'normal',
    template: 'appointment.confirmed',
    templateData: {
      doctorName: `${selectedDoctor.firstName} ${selectedDoctor.lastName}`,
      date: new Date(slotResult.scheduledAt).toLocaleDateString(),
      time: new Date(slotResult.scheduledAt).toLocaleTimeString(),
      checkInCode,
    },
  }).catch((err) => {
    logger.error({ err }, 'Failed to send appointment confirmation notification');
  });

  // Calculate estimated wait based on queue position
  const queueResult = await query(
    `SELECT COUNT(*) AS queue_size
     FROM appointments
     WHERE doctor_id = $1
       AND DATE(scheduled_at) = DATE($2)
       AND scheduled_at < $2
       AND status IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN')`,
    [selectedDoctor.id, slotResult.scheduledAt],
  );
  const queueSize = Number(queueResult.rows[0]?.queue_size ?? 0);
  const estimatedWaitMinutes = queueSize * durationMinutes;

  logger.info(
    {
      appointmentId,
      doctorId: selectedDoctor.id,
      scheduledAt: slotResult.scheduledAt,
      estimatedWait: estimatedWaitMinutes,
    },
    'Appointment scheduled',
  );

  return {
    appointment: mappedAppointment,
    alternativeSlots: slotResult.alternativeSlots.map((s) => ({
      ...s,
      isAvailable: true,
    })),
    estimatedWaitMinutes,
  };
}

// ---------------------------------------------------------------------------
// Calendar sync
// ---------------------------------------------------------------------------

/**
 * Generate an iCalendar (.ics) string for an appointment.
 */
export function generateIcsEvent(appointment: AppointmentRecord, doctorName: string): string {
  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + appointment.durationMinutes * 60_000);

  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uzavita//Appointment//EN',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@uzavita.com`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:Medical Appointment with Dr. ${doctorName}`,
    `DESCRIPTION:Check-in code: ${appointment.checkInCode}\\nReason: ${appointment.reason ?? 'N/A'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// ---------------------------------------------------------------------------
// Reminder scheduling
// ---------------------------------------------------------------------------

/**
 * Schedule a reminder notification for an appointment (24 hours before).
 */
export async function scheduleReminder(appointmentId: string): Promise<void> {
  const result = await query(
    `SELECT a.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.id = $1`,
    [appointmentId],
  );

  if (result.rows.length === 0) return;

  const row = result.rows[0];
  const scheduledAt = new Date(row.scheduled_at as string);
  const reminderTime = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);

  // If the appointment is less than 24 hours away, send immediately
  if (reminderTime.getTime() <= Date.now()) {
    await sendNotification({
      recipientId: row.patient_id as string,
      urgency: 'normal',
      template: 'appointment.reminder',
      templateData: {
        doctorName: `${row.doctor_first_name} ${row.doctor_last_name}`,
        time: scheduledAt.toLocaleTimeString(),
        checkInCode: row.check_in_code as string,
      },
    });
  } else {
    // In production, this would use a job scheduler (e.g., BullMQ, pg-boss)
    // For now, store in a reminders table for a background worker to pick up
    await query(
      `INSERT INTO appointment_reminders (id, appointment_id, scheduled_for, sent, created_at)
       VALUES ($1, $2, $3, false, NOW())
       ON CONFLICT (appointment_id) DO NOTHING`,
      [uuidv4(), appointmentId, reminderTime.toISOString()],
    );

    logger.debug({ appointmentId, reminderTime: reminderTime.toISOString() }, 'Reminder scheduled');
  }
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapAppointmentRow(row: Record<string, unknown>): AppointmentRecord {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    doctorId: row.doctor_id as string,
    institutionId: (row.institution_id as string) ?? null,
    scheduledAt: (row.scheduled_at as Date)?.toISOString(),
    durationMinutes: (row.duration_minutes as number) ?? 30,
    status: row.status as string,
    checkInCode: row.check_in_code as string,
    estimatedWait: (row.estimated_wait as number) ?? null,
    reason: (row.reason as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}
