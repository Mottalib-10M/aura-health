import { query } from '../../config/database.js';
import { executeTriage, type TriageInput, type TriageOutput } from '../../services/ai/triage-engine.js';
import { scheduleAppointment } from '../appointment/index.js';
import { sendNotification } from '../../services/notification/index.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageRequest {
  patientId: string;
  symptoms: string[];
  symptomDescription: string;
  duration?: string;
  severity?: number;
  vitalSigns?: {
    heartRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    respiratoryRate?: number;
    spO2?: number;
  };
  language?: string;
  autoScheduleFollowUp?: boolean;
}

export interface TriageResult {
  triageOutput: TriageOutput;
  followUpAppointmentId: string | null;
  notificationsSent: boolean;
}

export interface TriageHistoryEntry {
  id: string;
  patientId: string;
  symptoms: string[];
  symptomDescription: string;
  urgencyLevel: string;
  confidenceScore: number;
  recommendedSpecializations: string[];
  redFlags: string[];
  suggestedDiagnostics: string[];
  differentialDiagnoses: Array<{ code: string; name: string; probability: number }>;
  modelUsed: string;
  responseLatencyMs: number;
  followUpScheduled: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Orchestrate triage flow
// ---------------------------------------------------------------------------

/**
 * Orchestrate the full triage flow:
 * 1. Validate input
 * 2. Run AI triage engine
 * 3. Send appropriate notifications based on urgency
 * 4. Optionally schedule follow-up appointment
 * 5. Return combined result
 */
export async function performTriage(request: TriageRequest): Promise<TriageResult> {
  logger.info(
    { patientId: request.patientId, symptomCount: request.symptoms.length },
    'Triage flow initiated',
  );

  // Step 1: Validate patient exists
  const patientResult = await query(
    `SELECT id, aura_id, region, language FROM patients WHERE id = $1`,
    [request.patientId],
  );

  if (patientResult.rows.length === 0) {
    throw new Error('Patient not found');
  }

  const patient = patientResult.rows[0];
  const patientLanguage = request.language ?? (patient.language as string) ?? 'en';

  // Step 2: Execute AI triage
  const triageInput: TriageInput = {
    patientId: request.patientId,
    symptoms: request.symptoms,
    symptomDescription: request.symptomDescription,
    duration: request.duration,
    severity: request.severity,
    vitalSigns: request.vitalSigns,
    language: patientLanguage,
  };

  const triageOutput = await executeTriage(triageInput);

  // Step 3: Send notifications based on urgency
  let notificationsSent = false;
  try {
    if (triageOutput.urgencyLevel === 'EMERGENCY') {
      await sendNotification({
        recipientId: request.patientId,
        urgency: 'critical',
        template: 'triage.emergency',
        templateData: {},
        language: patientLanguage,
      });
      notificationsSent = true;

      // Also notify the nearest hospital
      await notifyNearestHospital(patient.region as string, request.patientId);
    } else if (triageOutput.urgencyLevel === 'URGENT') {
      const specialty = triageOutput.recommendedSpecializations[0] ?? 'General Medicine';
      await sendNotification({
        recipientId: request.patientId,
        urgency: 'high',
        template: 'triage.urgent',
        templateData: { specialty },
        language: patientLanguage,
      });
      notificationsSent = true;
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send triage notifications');
  }

  // Step 4: Schedule follow-up if recommended and requested
  let followUpAppointmentId: string | null = null;

  if (triageOutput.followUpRecommended && request.autoScheduleFollowUp !== false) {
    try {
      const specialty = triageOutput.recommendedSpecializations[0] ?? 'General Medicine';

      // For EMERGENCY, don't auto-schedule — patient should go to ER immediately
      if (triageOutput.urgencyLevel !== 'EMERGENCY') {
        const appointmentResult = await scheduleAppointment({
          patientId: request.patientId,
          specialty,
          urgencyLevel: triageOutput.urgencyLevel,
          reason: `Triage follow-up: ${request.symptoms.slice(0, 3).join(', ')}`,
        });

        followUpAppointmentId = appointmentResult.appointment.id;

        // Update triage event with follow-up info
        await query(
          `UPDATE triage_events
           SET follow_up_scheduled = true
           WHERE id = (SELECT id FROM triage_events WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1)`,
          [request.patientId],
        );

        logger.info(
          { patientId: request.patientId, appointmentId: followUpAppointmentId },
          'Follow-up appointment auto-scheduled',
        );
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to auto-schedule follow-up appointment');
    }
  }

  return {
    triageOutput,
    followUpAppointmentId,
    notificationsSent,
  };
}

// ---------------------------------------------------------------------------
// Triage history
// ---------------------------------------------------------------------------

/**
 * Retrieve a patient's triage history with optional date filtering.
 */
export async function getTriageHistory(
  patientId: string,
  options: { limit?: number; offset?: number; startDate?: string; endDate?: string } = {},
): Promise<TriageHistoryEntry[]> {
  let sql = `SELECT * FROM triage_events WHERE patient_id = $1`;
  const params: unknown[] = [patientId];
  let paramIdx = 2;

  if (options.startDate) {
    sql += ` AND created_at >= $${paramIdx++}`;
    params.push(options.startDate);
  }
  if (options.endDate) {
    sql += ` AND created_at <= $${paramIdx++}`;
    params.push(options.endDate);
  }

  sql += ` ORDER BY created_at DESC`;
  sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(options.limit ?? 50, options.offset ?? 0);

  const result = await query(sql, params);
  return result.rows.map(mapTriageHistoryRow);
}

/**
 * Get triage statistics for a patient — useful for trend analysis.
 */
export async function getTriageStats(patientId: string): Promise<{
  totalEvents: number;
  emergencyCount: number;
  urgentCount: number;
  averageConfidence: number;
  mostCommonSpecialties: Array<{ specialty: string; count: number }>;
  lastTriageDate: string | null;
}> {
  const statsResult = await query(
    `SELECT
       COUNT(*) AS total_events,
       COUNT(*) FILTER (WHERE urgency_level = 'EMERGENCY') AS emergency_count,
       COUNT(*) FILTER (WHERE urgency_level = 'URGENT') AS urgent_count,
       AVG(confidence_score) AS avg_confidence,
       MAX(created_at) AS last_triage_date
     FROM triage_events
     WHERE patient_id = $1`,
    [patientId],
  );

  const specialtyResult = await query(
    `SELECT specialty, COUNT(*) AS count
     FROM (
       SELECT jsonb_array_elements_text(recommended_specializations) AS specialty
       FROM triage_events
       WHERE patient_id = $1
     ) sub
     GROUP BY specialty
     ORDER BY count DESC
     LIMIT 5`,
    [patientId],
  );

  const stats = statsResult.rows[0];
  return {
    totalEvents: Number(stats?.total_events ?? 0),
    emergencyCount: Number(stats?.emergency_count ?? 0),
    urgentCount: Number(stats?.urgent_count ?? 0),
    averageConfidence: Math.round(Number(stats?.avg_confidence ?? 0) * 100) / 100,
    mostCommonSpecialties: specialtyResult.rows.map((r) => ({
      specialty: r.specialty as string,
      count: Number(r.count),
    })),
    lastTriageDate: stats?.last_triage_date
      ? (stats.last_triage_date as Date).toISOString()
      : null,
  };
}

// ---------------------------------------------------------------------------
// Follow-up management
// ---------------------------------------------------------------------------

/**
 * Check for patients who had triage events with follow-up recommended
 * but haven't scheduled appointments yet.
 */
export async function getPendingFollowUps(region?: string): Promise<Array<{
  patientId: string;
  triageEventId: string;
  urgencyLevel: string;
  recommendedSpecialty: string;
  triageDate: string;
  daysSinceTriage: number;
}>> {
  let sql = `
    SELECT
      te.id AS triage_event_id,
      te.patient_id,
      te.urgency_level,
      te.recommended_specializations[1] AS recommended_specialty,
      te.created_at AS triage_date,
      EXTRACT(DAY FROM NOW() - te.created_at)::INT AS days_since_triage
    FROM triage_events te
    LEFT JOIN appointments a ON a.patient_id = te.patient_id
      AND a.created_at > te.created_at
      AND a.status NOT IN ('CANCELLED')
    WHERE te.follow_up_scheduled = false
      AND a.id IS NULL
      AND te.urgency_level IN ('URGENT', 'SEMI_URGENT')
      AND te.created_at > NOW() - INTERVAL '30 days'
  `;

  const params: unknown[] = [];

  if (region) {
    sql += `
      AND te.patient_id IN (
        SELECT id FROM patients WHERE region = $1
      )
    `;
    params.push(region);
  }

  sql += ` ORDER BY te.urgency_level = 'URGENT' DESC, te.created_at ASC LIMIT 100`;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    patientId: row.patient_id as string,
    triageEventId: row.triage_event_id as string,
    urgencyLevel: row.urgency_level as string,
    recommendedSpecialty: (row.recommended_specialty as string) ?? 'General Medicine',
    triageDate: (row.triage_date as Date).toISOString(),
    daysSinceTriage: Number(row.days_since_triage),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function notifyNearestHospital(region: string, patientId: string): Promise<void> {
  try {
    const hospitalResult = await query(
      `SELECT id FROM institutions
       WHERE region = $1 AND type = 'HOSPITAL'
       ORDER BY tier DESC
       LIMIT 1`,
      [region],
    );

    if (hospitalResult.rows.length > 0) {
      logger.info(
        { hospitalId: hospitalResult.rows[0].id, patientId, region },
        'Emergency triage: nearest hospital notified',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Failed to notify nearest hospital');
  }
}

function mapTriageHistoryRow(row: Record<string, unknown>): TriageHistoryEntry {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    symptoms: (row.symptoms as string[]) ?? [],
    symptomDescription: row.symptom_description as string,
    urgencyLevel: row.urgency_level as string,
    confidenceScore: Number(row.confidence_score),
    recommendedSpecializations: (row.recommended_specializations as string[]) ?? [],
    redFlags: (row.red_flags as string[]) ?? [],
    suggestedDiagnostics: (row.suggested_diagnostics as string[]) ?? [],
    differentialDiagnoses: (row.differential_diagnoses as Array<{ code: string; name: string; probability: number }>) ?? [],
    modelUsed: row.model_used as string,
    responseLatencyMs: Number(row.response_latency_ms),
    followUpScheduled: (row.follow_up_scheduled as boolean) ?? false,
    createdAt: (row.created_at as Date)?.toISOString(),
  };
}
