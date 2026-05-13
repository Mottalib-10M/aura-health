import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { generateRsaKeyPair, sha256 } from '../../utils/crypto.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatientCreateInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType?: string;
  region: string;
  city: string;
  language?: string;
  phone?: string;
  email?: string;
}

export interface PatientUpdateInput {
  firstName?: string;
  lastName?: string;
  bloodType?: string;
  region?: string;
  city?: string;
  language?: string;
}

export interface PatientRecord {
  id: string;
  auraId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  region: string;
  city: string;
  language: string;
  publicKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TelemetryDataPoint {
  metricType: string;
  value: number;
  recordedAt: string;
  deviceId?: string;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Create a new patient with a generated Aura ID and RSA key pair.
 */
export async function createPatient(input: PatientCreateInput): Promise<PatientRecord> {
  const patientId = uuidv4();
  const regionCode = input.region.slice(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  const auraId = `AH-${regionCode}-${randomSuffix}`;

  // Generate key pair for end-to-end encryption
  const keyPair = generateRsaKeyPair();

  // Generate biometric hash placeholder (would be from actual biometric data)
  const biometricHash = sha256(`${input.firstName}:${input.lastName}:${input.dateOfBirth}`);

  const result = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO patients (
        id, aura_id, first_name, last_name,
        date_of_birth, gender, blood_type,
        region, city, language,
        biometric_hash, public_key,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        patientId, auraId, input.firstName, input.lastName,
        input.dateOfBirth, input.gender, input.bloodType ?? null,
        input.region, input.city, input.language ?? 'uz',
        biometricHash, keyPair.publicKey,
      ],
    );

    // Store contact information separately (for notification lookups)
    if (input.phone || input.email) {
      await client.query(
        `INSERT INTO patient_contacts (id, patient_id, phone, email, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [uuidv4(), patientId, input.phone ?? null, input.email ?? null],
      );
    }

    return inserted.rows[0];
  });

  logger.info({ patientId, auraId, region: input.region }, 'Patient created');
  return mapPatientRow(result);
}

/**
 * Get a patient by their internal UUID.
 */
export async function getPatientById(id: string): Promise<PatientRecord | null> {
  const result = await query(`SELECT * FROM patients WHERE id = $1`, [id]);
  return result.rows[0] ? mapPatientRow(result.rows[0]) : null;
}

/**
 * Get a patient by their Aura ID (the public-facing identifier).
 */
export async function getPatientByAuraId(auraId: string): Promise<PatientRecord | null> {
  const result = await query(`SELECT * FROM patients WHERE aura_id = $1`, [auraId]);
  return result.rows[0] ? mapPatientRow(result.rows[0]) : null;
}

/**
 * Update a patient's profile.
 */
export async function updatePatient(id: string, input: PatientUpdateInput): Promise<PatientRecord | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (input.firstName !== undefined) {
    setClauses.push(`first_name = $${paramIdx++}`);
    params.push(input.firstName);
  }
  if (input.lastName !== undefined) {
    setClauses.push(`last_name = $${paramIdx++}`);
    params.push(input.lastName);
  }
  if (input.bloodType !== undefined) {
    setClauses.push(`blood_type = $${paramIdx++}`);
    params.push(input.bloodType);
  }
  if (input.region !== undefined) {
    setClauses.push(`region = $${paramIdx++}`);
    params.push(input.region);
  }
  if (input.city !== undefined) {
    setClauses.push(`city = $${paramIdx++}`);
    params.push(input.city);
  }
  if (input.language !== undefined) {
    setClauses.push(`language = $${paramIdx++}`);
    params.push(input.language);
  }

  if (setClauses.length === 0) return getPatientById(id);

  setClauses.push('updated_at = NOW()');
  params.push(id);

  const result = await query(
    `UPDATE patients SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );

  if (result.rows.length === 0) return null;

  logger.info({ patientId: id }, 'Patient profile updated');
  return mapPatientRow(result.rows[0]);
}

/**
 * Soft-delete a patient (for GDPR/data-protection compliance).
 */
export async function deactivatePatient(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE patients SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Telemetry data
// ---------------------------------------------------------------------------

/**
 * Ingest a batch of telemetry data points from a wearable device.
 */
export async function ingestTelemetry(
  patientId: string,
  dataPoints: TelemetryDataPoint[],
): Promise<number> {
  if (dataPoints.length === 0) return 0;

  // Build a multi-row INSERT for efficiency
  const values: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const dp of dataPoints) {
    values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
    params.push(uuidv4(), patientId, dp.metricType, dp.value, dp.recordedAt);
  }

  const result = await query(
    `INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, recorded_at)
     VALUES ${values.join(', ')}`,
    params,
  );

  logger.debug(
    { patientId, count: dataPoints.length },
    'Telemetry data ingested',
  );

  return result.rowCount ?? 0;
}

/**
 * Retrieve recent telemetry for a patient.
 */
export async function getRecentTelemetry(
  patientId: string,
  metricType?: string,
  hours = 24,
): Promise<TelemetryDataPoint[]> {
  let sql = `
    SELECT metric_type, value, recorded_at, device_id
    FROM biometric_telemetry
    WHERE patient_id = $1
      AND recorded_at > NOW() - ($2 || ' hours')::INTERVAL
  `;
  const params: unknown[] = [patientId, hours];

  if (metricType) {
    sql += ` AND metric_type = $3`;
    params.push(metricType);
  }

  sql += ` ORDER BY recorded_at DESC LIMIT 1000`;

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    metricType: row.metric_type as string,
    value: row.value as number,
    recordedAt: (row.recorded_at as Date).toISOString(),
    deviceId: row.device_id as string | undefined,
  }));
}

// ---------------------------------------------------------------------------
// Appointment history
// ---------------------------------------------------------------------------

/**
 * Get a patient's appointment history with optional status filtering.
 */
export async function getPatientAppointments(
  patientId: string,
  options: { status?: string; limit?: number; offset?: number } = {},
): Promise<unknown[]> {
  let sql = `
    SELECT a.*, d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, d.specialty
    FROM appointments a
    LEFT JOIN doctors d ON d.id = a.doctor_id
    WHERE a.patient_id = $1
  `;
  const params: unknown[] = [patientId];
  let paramIdx = 2;

  if (options.status) {
    sql += ` AND a.status = $${paramIdx++}`;
    params.push(options.status);
  }

  sql += ` ORDER BY a.scheduled_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(options.limit ?? 20, options.offset ?? 0);

  const result = await query(sql, params);
  return result.rows;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search patients by name, Aura ID, or region.
 */
export async function searchPatients(criteria: {
  nameQuery?: string;
  region?: string;
  city?: string;
  limit?: number;
}): Promise<PatientRecord[]> {
  const conditions: string[] = ['is_active IS NOT FALSE'];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (criteria.nameQuery) {
    conditions.push(`(first_name ILIKE $${paramIdx} OR last_name ILIKE $${paramIdx} OR aura_id ILIKE $${paramIdx})`);
    params.push(`%${criteria.nameQuery}%`);
    paramIdx++;
  }
  if (criteria.region) {
    conditions.push(`region = $${paramIdx++}`);
    params.push(criteria.region);
  }
  if (criteria.city) {
    conditions.push(`city = $${paramIdx++}`);
    params.push(criteria.city);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(criteria.limit ?? 50);

  const result = await query(
    `SELECT * FROM patients ${where} ORDER BY created_at DESC LIMIT $${paramIdx}`,
    params,
  );

  return result.rows.map(mapPatientRow);
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapPatientRow(row: Record<string, unknown>): PatientRecord {
  return {
    id: row.id as string,
    auraId: row.aura_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    dateOfBirth: row.date_of_birth as string,
    gender: row.gender as string,
    bloodType: (row.blood_type as string) ?? null,
    region: row.region as string,
    city: row.city as string,
    language: (row.language as string) ?? 'uz',
    publicKey: (row.public_key as string) ?? null,
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}
