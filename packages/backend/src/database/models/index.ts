import { query, withTransaction } from '../../config/database.js';
import type pg from 'pg';

// ---------------------------------------------------------------------------
// Generic query helpers
// ---------------------------------------------------------------------------

/**
 * Find a single row by primary key.
 */
export async function findById<T extends pg.QueryResultRow>(
  table: string,
  id: string,
): Promise<T | null> {
  const result = await query<T>(`SELECT * FROM ${sanitizeIdentifier(table)} WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

/**
 * Find rows matching a set of conditions (AND-ed).
 */
export async function findWhere<T extends pg.QueryResultRow>(
  table: string,
  conditions: Record<string, unknown>,
  options: { limit?: number; offset?: number; orderBy?: string; orderDir?: 'ASC' | 'DESC' } = {},
): Promise<T[]> {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);

  const whereClauses = keys.map((key, idx) => `${sanitizeIdentifier(key)} = $${idx + 1}`);
  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let sql = `SELECT * FROM ${sanitizeIdentifier(table)} ${where}`;

  if (options.orderBy) {
    sql += ` ORDER BY ${sanitizeIdentifier(options.orderBy)} ${options.orderDir ?? 'ASC'}`;
  }

  const paramIdx = values.length + 1;
  sql += ` LIMIT $${paramIdx}`;
  values.push(options.limit ?? 100);

  if (options.offset) {
    sql += ` OFFSET $${paramIdx + 1}`;
    values.push(options.offset);
  }

  const result = await query<T>(sql, values);
  return result.rows;
}

/**
 * Insert a new row and return it.
 */
export async function insert<T extends pg.QueryResultRow>(
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const columns = keys.map(sanitizeIdentifier).join(', ');
  const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');

  const result = await query<T>(
    `INSERT INTO ${sanitizeIdentifier(table)} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values,
  );

  return result.rows[0];
}

/**
 * Update rows by ID and return the updated row.
 */
export async function updateById<T extends pg.QueryResultRow>(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<T | null> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClauses = keys.map((key, idx) => `${sanitizeIdentifier(key)} = $${idx + 1}`).join(', ');

  values.push(id);

  const result = await query<T>(
    `UPDATE ${sanitizeIdentifier(table)} SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
    values,
  );

  return result.rows[0] ?? null;
}

/**
 * Delete a row by ID.
 */
export async function deleteById(table: string, id: string): Promise<boolean> {
  const result = await query(`DELETE FROM ${sanitizeIdentifier(table)} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Count rows matching conditions.
 */
export async function count(
  table: string,
  conditions: Record<string, unknown> = {},
): Promise<number> {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);

  const whereClauses = keys.map((key, idx) => `${sanitizeIdentifier(key)} = $${idx + 1}`);
  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await query(`SELECT COUNT(*) AS count FROM ${sanitizeIdentifier(table)} ${where}`, values);
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Check existence.
 */
export async function exists(table: string, id: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM ${sanitizeIdentifier(table)} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows.length > 0;
}

// ---------------------------------------------------------------------------
// Table-specific query helpers
// ---------------------------------------------------------------------------

export const patients = {
  findById: (id: string) => findById('patients', id),
  findByAuraId: async (auraId: string) => {
    const result = await query(`SELECT * FROM patients WHERE aura_id = $1`, [auraId]);
    return result.rows[0] ?? null;
  },
  findByRegion: (region: string, limit = 100) =>
    findWhere('patients', { region }, { limit, orderBy: 'created_at', orderDir: 'DESC' }),
  count: (conditions?: Record<string, unknown>) => count('patients', conditions),
};

export const doctors = {
  findById: (id: string) => findById('doctors', id),
  findByLicense: async (licenseNumber: string) => {
    const result = await query(`SELECT * FROM doctors WHERE license_number = $1`, [licenseNumber]);
    return result.rows[0] ?? null;
  },
  findBySpecialty: (specialty: string, region?: string) => {
    const conditions: Record<string, unknown> = { specialty, verification_status: 'VERIFIED' };
    if (region) conditions.region = region;
    return findWhere('doctors', conditions, { orderBy: 'efficacy_score', orderDir: 'DESC' });
  },
  countByStatus: async (status: string) => count('doctors', { verification_status: status }),
};

export const institutions = {
  findById: (id: string) => findById('institutions', id),
  findByRegion: (region: string) =>
    findWhere('institutions', { region }, { orderBy: 'name', orderDir: 'ASC' }),
  findByType: (type: string) =>
    findWhere('institutions', { type }, { orderBy: 'tier', orderDir: 'DESC' }),
};

export const biometricTelemetry = {
  /**
   * Fetch the most recent telemetry data for a patient.
   */
  getLatest: async (patientId: string, metricType?: string, limit = 100) => {
    let sql = `SELECT * FROM biometric_telemetry WHERE patient_id = $1`;
    const params: unknown[] = [patientId];

    if (metricType) {
      sql += ` AND metric_type = $2`;
      params.push(metricType);
    }

    sql += ` ORDER BY recorded_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Get aggregated stats for a time window.
   */
  getStats: async (patientId: string, metricType: string, hours = 24) => {
    const result = await query(
      `SELECT
         COUNT(*) AS data_points,
         AVG(value) AS avg_value,
         MIN(value) AS min_value,
         MAX(value) AS max_value,
         STDDEV(value) AS stddev_value,
         MAX(recorded_at) AS last_reading
       FROM biometric_telemetry
       WHERE patient_id = $1
         AND metric_type = $2
         AND recorded_at > NOW() - ($3 || ' hours')::INTERVAL`,
      [patientId, metricType, hours],
    );
    return result.rows[0] ?? null;
  },
};

export const triageEvents = {
  findById: (id: string) => findById('triage_events', id),
  findByPatient: (patientId: string, limit = 50) =>
    findWhere('triage_events', { patient_id: patientId }, {
      limit,
      orderBy: 'created_at',
      orderDir: 'DESC',
    }),
};

export const prescriptions = {
  findById: (id: string) => findById('prescriptions', id),
  findByPatient: (patientId: string, limit = 50) =>
    findWhere('prescriptions', { patient_id: patientId }, {
      limit,
      orderBy: 'created_at',
      orderDir: 'DESC',
    }),
  findByDoctor: (doctorId: string, limit = 50) =>
    findWhere('prescriptions', { doctor_id: doctorId }, {
      limit,
      orderBy: 'created_at',
      orderDir: 'DESC',
    }),
};

export const surveillanceData = {
  findByRegion: async (region: string, startDate?: string, endDate?: string) => {
    let sql = `SELECT * FROM surveillance_data WHERE region = $1`;
    const params: unknown[] = [region];

    if (startDate) {
      sql += ` AND report_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND report_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    sql += ` ORDER BY report_date DESC LIMIT 500`;

    const result = await query(sql, params);
    return result.rows;
  },
};

// ---------------------------------------------------------------------------
// SQL identifier sanitization (prevent injection in dynamic table/column names)
// ---------------------------------------------------------------------------

const VALID_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function sanitizeIdentifier(name: string): string {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return `"${name}"`;
}
