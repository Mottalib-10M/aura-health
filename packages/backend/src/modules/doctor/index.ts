import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { attestCredential } from '../../services/blockchain/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoctorCreateInput {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specialty: string;
  subspecialty?: string;
  institutionId?: string;
  region: string;
  languages: string[];
  credentialDocumentUrl?: string;
}

export interface DoctorRecord {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specialty: string;
  subspecialty: string | null;
  institutionId: string | null;
  verificationStatus: string;
  efficacyScore: number | null;
  satisfactionScore: number | null;
  consultationCount: number;
  region: string;
  languages: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DoctorScheduleSlot {
  dayOfWeek: number; // 0=Sunday ... 6=Saturday
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  isAvailable: boolean;
}

export interface EfficacyMetric {
  drugName: string;
  diagnosisCode: string;
  cohortSize: number;
  avgEfficacyScore: number;
  avgDaysToImprovement: number;
}

// ---------------------------------------------------------------------------
// Registration & CRUD
// ---------------------------------------------------------------------------

/**
 * Register a new doctor. Their status starts as PENDING until credentials
 * are verified by an administrator.
 */
export async function registerDoctor(input: DoctorCreateInput): Promise<DoctorRecord> {
  // Check for duplicate license number
  const existing = await query(
    `SELECT id FROM doctors WHERE license_number = $1`,
    [input.licenseNumber],
  );

  if (existing.rows.length > 0) {
    throw new Error('DUPLICATE_LICENSE: A doctor with this license number already exists');
  }

  const doctorId = uuidv4();

  const result = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO doctors (
        id, first_name, last_name, license_number,
        specialty, subspecialty, institution_id,
        verification_status, region, languages,
        consultation_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, 0, NOW(), NOW())
      RETURNING *`,
      [
        doctorId, input.firstName, input.lastName, input.licenseNumber,
        input.specialty, input.subspecialty ?? null, input.institutionId ?? null,
        input.region, JSON.stringify(input.languages),
      ],
    );

    // Store credential document reference
    if (input.credentialDocumentUrl) {
      await client.query(
        `INSERT INTO doctor_credentials (id, doctor_id, document_url, uploaded_at)
         VALUES ($1, $2, $3, NOW())`,
        [uuidv4(), doctorId, input.credentialDocumentUrl],
      );
    }

    // Create default schedule (Mon-Fri 9:00-17:00)
    for (let day = 1; day <= 5; day++) {
      await client.query(
        `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1, $2, $3, '09:00', '17:00', true)`,
        [uuidv4(), doctorId, day],
      );
    }

    return inserted.rows[0];
  });

  logger.info(
    { doctorId, specialty: input.specialty, region: input.region },
    'Doctor registered',
  );

  return mapDoctorRow(result);
}

/**
 * Retrieve a doctor by ID.
 */
export async function getDoctorById(id: string): Promise<DoctorRecord | null> {
  const result = await query(`SELECT * FROM doctors WHERE id = $1`, [id]);
  return result.rows[0] ? mapDoctorRow(result.rows[0]) : null;
}

/**
 * Search for doctors by specialty and/or region.
 */
export async function searchDoctors(criteria: {
  specialty?: string;
  region?: string;
  verificationStatus?: string;
  limit?: number;
}): Promise<DoctorRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (criteria.specialty) {
    conditions.push(`specialty = $${paramIdx++}`);
    params.push(criteria.specialty);
  }
  if (criteria.region) {
    conditions.push(`region = $${paramIdx++}`);
    params.push(criteria.region);
  }
  if (criteria.verificationStatus) {
    conditions.push(`verification_status = $${paramIdx++}`);
    params.push(criteria.verificationStatus);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(criteria.limit ?? 50);

  const result = await query(
    `SELECT * FROM doctors ${where} ORDER BY efficacy_score DESC NULLS LAST LIMIT $${paramIdx}`,
    params,
  );

  return result.rows.map(mapDoctorRow);
}

// ---------------------------------------------------------------------------
// Credential management
// ---------------------------------------------------------------------------

/**
 * Update a doctor's verification status. Only callable by administrators.
 */
export async function updateVerificationStatus(
  doctorId: string,
  newStatus: string,
  changedBy: string,
  notes?: string,
): Promise<DoctorRecord> {
  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE doctors SET verification_status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [doctorId, newStatus],
    );

    if (updated.rows.length === 0) {
      throw new Error('Doctor not found');
    }

    // Audit log entry
    await client.query(
      `INSERT INTO verification_audit_log (id, doctor_id, new_status, changed_by, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), doctorId, newStatus, changedBy, notes ?? null],
    );

    return updated.rows[0];
  });

  // If verified, attest on blockchain
  if (newStatus === 'VERIFIED') {
    attestCredential({
      doctorId,
      licenseNumber: result.license_number as string,
      issuingAuthority: 'Ministry of Health',
      documentHash: '',
      attestedBy: changedBy,
      attestedAt: new Date().toISOString(),
    }).catch((err) => {
      logger.error({ err, doctorId }, 'Blockchain credential attestation failed');
    });
  }

  logger.info({ doctorId, newStatus, changedBy }, 'Doctor verification status updated');
  return mapDoctorRow(result);
}

// ---------------------------------------------------------------------------
// Schedule management
// ---------------------------------------------------------------------------

/**
 * Get a doctor's weekly schedule.
 */
export async function getDoctorSchedule(doctorId: string): Promise<DoctorScheduleSlot[]> {
  const result = await query(
    `SELECT day_of_week, start_time, end_time, is_available
     FROM doctor_schedules
     WHERE doctor_id = $1
     ORDER BY day_of_week, start_time`,
    [doctorId],
  );

  return result.rows.map((row) => ({
    dayOfWeek: row.day_of_week as number,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    isAvailable: row.is_available as boolean,
  }));
}

/**
 * Update a doctor's schedule for a specific day.
 */
export async function updateScheduleSlot(
  doctorId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isAvailable: boolean,
): Promise<void> {
  await query(
    `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, is_available)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (doctor_id, day_of_week, start_time)
     DO UPDATE SET end_time = $5, is_available = $6`,
    [uuidv4(), doctorId, dayOfWeek, startTime, endTime, isAvailable],
  );
}

/**
 * Get available time slots for a doctor on a specific date.
 */
export async function getAvailableSlots(
  doctorId: string,
  date: string,
  durationMinutes = 30,
): Promise<Array<{ startTime: string; endTime: string }>> {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  // Get the doctor's schedule for this day
  const scheduleResult = await query(
    `SELECT start_time, end_time FROM doctor_schedules
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true
     ORDER BY start_time`,
    [doctorId, dayOfWeek],
  );

  if (scheduleResult.rows.length === 0) return [];

  // Get existing appointments on this date
  const appointmentResult = await query(
    `SELECT scheduled_at, duration_minutes FROM appointments
     WHERE doctor_id = $1 AND DATE(scheduled_at) = $2
       AND status NOT IN ('CANCELLED', 'NO_SHOW')
     ORDER BY scheduled_at`,
    [doctorId, date],
  );

  const bookedSlots = appointmentResult.rows.map((row) => ({
    start: new Date(row.scheduled_at as string).getTime(),
    end: new Date(row.scheduled_at as string).getTime() + (row.duration_minutes as number) * 60_000,
  }));

  // Generate available slots
  const availableSlots: Array<{ startTime: string; endTime: string }> = [];

  for (const scheduleRow of scheduleResult.rows) {
    const [schedStartH, schedStartM] = (scheduleRow.start_time as string).split(':').map(Number);
    const [schedEndH, schedEndM] = (scheduleRow.end_time as string).split(':').map(Number);

    let currentMinutes = schedStartH * 60 + schedStartM;
    const endMinutes = schedEndH * 60 + schedEndM;

    while (currentMinutes + durationMinutes <= endMinutes) {
      const slotStart = new Date(targetDate);
      slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

      // Check if this slot conflicts with any booked appointment
      const isBooked = bookedSlots.some(
        (booked) => slotStart.getTime() < booked.end && slotEnd.getTime() > booked.start,
      );

      if (!isBooked) {
        availableSlots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
        });
      }

      currentMinutes += durationMinutes;
    }
  }

  return availableSlots;
}

// ---------------------------------------------------------------------------
// Efficacy metrics
// ---------------------------------------------------------------------------

/**
 * Calculate a doctor's aggregate efficacy metrics based on prescription outcomes.
 */
export async function getEfficacyMetrics(doctorId: string): Promise<EfficacyMetric[]> {
  const result = await query(
    `SELECT
       m.drug_name,
       p.diagnosis_codes[1] AS diagnosis_code,
       COUNT(*) AS cohort_size,
       AVG(p.efficacy_score) AS avg_efficacy_score,
       AVG(EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) / 86400) AS avg_days_to_improvement
     FROM prescriptions p,
       LATERAL jsonb_array_elements(p.medications) AS m_elem,
       LATERAL jsonb_to_record(m_elem) AS m(drug_name TEXT, dosage TEXT)
     WHERE p.doctor_id = $1
       AND p.efficacy_score IS NOT NULL
     GROUP BY m.drug_name, p.diagnosis_codes[1]
     ORDER BY cohort_size DESC
     LIMIT 50`,
    [doctorId],
  );

  return result.rows.map((row) => ({
    drugName: row.drug_name as string,
    diagnosisCode: row.diagnosis_code as string,
    cohortSize: Number(row.cohort_size),
    avgEfficacyScore: Number(row.avg_efficacy_score),
    avgDaysToImprovement: Math.round(Number(row.avg_days_to_improvement)),
  }));
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapDoctorRow(row: Record<string, unknown>): DoctorRecord {
  return {
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    licenseNumber: row.license_number as string,
    specialty: row.specialty as string,
    subspecialty: (row.subspecialty as string) ?? null,
    institutionId: (row.institution_id as string) ?? null,
    verificationStatus: row.verification_status as string,
    efficacyScore: row.efficacy_score as number | null,
    satisfactionScore: row.satisfaction_score as number | null,
    consultationCount: (row.consultation_count as number) ?? 0,
    region: row.region as string,
    languages: (row.languages as string[]) ?? [],
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}
