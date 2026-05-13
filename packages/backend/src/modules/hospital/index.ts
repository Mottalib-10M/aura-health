import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstitutionCreateInput {
  name: string;
  type: string;
  tier: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
  bedCapacity?: number;
  specialties: string[];
  equipment: string[];
}

export interface InstitutionRecord {
  id: string;
  name: string;
  type: string;
  tier: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  bedCapacity: number | null;
  currentOccupancy: number | null;
  specialties: string[];
  equipment: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRecord {
  id: string;
  institutionId: string;
  name: string;
  headDoctorId: string | null;
  bedCount: number;
  currentOccupancy: number;
}

export interface DepartmentStats {
  departmentId: string;
  departmentName: string;
  bedCount: number;
  currentOccupancy: number;
  occupancyRate: number;
  averageLengthOfStay: number;
  admissionsToday: number;
  dischargesToday: number;
}

export interface ResourceAllocation {
  resourceType: string;
  totalUnits: number;
  inUse: number;
  available: number;
  utilizationRate: number;
}

// ---------------------------------------------------------------------------
// Institution CRUD
// ---------------------------------------------------------------------------

export async function createInstitution(input: InstitutionCreateInput): Promise<InstitutionRecord> {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO institutions (
      id, name, type, tier, region, city,
      latitude, longitude, bed_capacity,
      current_occupancy, specialties, equipment,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, NOW(), NOW())
    RETURNING *`,
    [
      id, input.name, input.type, input.tier,
      input.region, input.city,
      input.latitude ?? null, input.longitude ?? null,
      input.bedCapacity ?? null,
      JSON.stringify(input.specialties),
      JSON.stringify(input.equipment),
    ],
  );

  logger.info({ institutionId: id, name: input.name, type: input.type }, 'Institution created');
  return mapInstitutionRow(result.rows[0]);
}

export async function getInstitutionById(id: string): Promise<InstitutionRecord | null> {
  const result = await query(`SELECT * FROM institutions WHERE id = $1`, [id]);
  return result.rows[0] ? mapInstitutionRow(result.rows[0]) : null;
}

export async function updateInstitution(
  id: string,
  updates: Partial<InstitutionCreateInput>,
): Promise<InstitutionRecord | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    type: 'type',
    tier: 'tier',
    region: 'region',
    city: 'city',
    latitude: 'latitude',
    longitude: 'longitude',
    bedCapacity: 'bed_capacity',
  };

  for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
    const value = updates[jsKey as keyof InstitutionCreateInput];
    if (value !== undefined) {
      setClauses.push(`${dbKey} = $${paramIdx++}`);
      params.push(value);
    }
  }

  if (updates.specialties) {
    setClauses.push(`specialties = $${paramIdx++}`);
    params.push(JSON.stringify(updates.specialties));
  }
  if (updates.equipment) {
    setClauses.push(`equipment = $${paramIdx++}`);
    params.push(JSON.stringify(updates.equipment));
  }

  if (setClauses.length === 0) return getInstitutionById(id);

  setClauses.push('updated_at = NOW()');
  params.push(id);

  const result = await query(
    `UPDATE institutions SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );

  return result.rows[0] ? mapInstitutionRow(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Department management
// ---------------------------------------------------------------------------

export async function createDepartment(
  institutionId: string,
  name: string,
  bedCount: number,
  headDoctorId?: string,
): Promise<DepartmentRecord> {
  const id = uuidv4();

  const result = await query(
    `INSERT INTO departments (id, institution_id, name, head_doctor_id, bed_count, current_occupancy, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, NOW())
     RETURNING *`,
    [id, institutionId, name, headDoctorId ?? null, bedCount],
  );

  return mapDepartmentRow(result.rows[0]);
}

export async function getDepartments(institutionId: string): Promise<DepartmentRecord[]> {
  const result = await query(
    `SELECT * FROM departments WHERE institution_id = $1 ORDER BY name`,
    [institutionId],
  );
  return result.rows.map(mapDepartmentRow);
}

export async function getDepartmentStats(institutionId: string): Promise<DepartmentStats[]> {
  const result = await query(
    `SELECT
       d.id AS department_id,
       d.name AS department_name,
       d.bed_count,
       d.current_occupancy,
       CASE WHEN d.bed_count > 0
            THEN ROUND(d.current_occupancy::NUMERIC / d.bed_count * 100, 1)
            ELSE 0
       END AS occupancy_rate,
       COALESCE(
         (SELECT AVG(EXTRACT(EPOCH FROM (discharge_at - admitted_at)) / 86400)
          FROM admissions
          WHERE department_id = d.id AND discharge_at IS NOT NULL
            AND admitted_at > NOW() - INTERVAL '30 days'),
         0
       ) AS average_length_of_stay,
       COALESCE(
         (SELECT COUNT(*)
          FROM admissions
          WHERE department_id = d.id AND DATE(admitted_at) = CURRENT_DATE),
         0
       ) AS admissions_today,
       COALESCE(
         (SELECT COUNT(*)
          FROM admissions
          WHERE department_id = d.id AND DATE(discharge_at) = CURRENT_DATE),
         0
       ) AS discharges_today
     FROM departments d
     WHERE d.institution_id = $1
     ORDER BY d.name`,
    [institutionId],
  );

  return result.rows.map((row) => ({
    departmentId: row.department_id as string,
    departmentName: row.department_name as string,
    bedCount: Number(row.bed_count),
    currentOccupancy: Number(row.current_occupancy),
    occupancyRate: Number(row.occupancy_rate),
    averageLengthOfStay: Math.round(Number(row.average_length_of_stay) * 10) / 10,
    admissionsToday: Number(row.admissions_today),
    dischargesToday: Number(row.discharges_today),
  }));
}

// ---------------------------------------------------------------------------
// Resource allocation
// ---------------------------------------------------------------------------

export async function getResourceAllocation(institutionId: string): Promise<ResourceAllocation[]> {
  const result = await query(
    `SELECT
       resource_type,
       SUM(total_units) AS total_units,
       SUM(in_use) AS in_use,
       SUM(total_units - in_use) AS available,
       CASE WHEN SUM(total_units) > 0
            THEN ROUND(SUM(in_use)::NUMERIC / SUM(total_units) * 100, 1)
            ELSE 0
       END AS utilization_rate
     FROM institution_resources
     WHERE institution_id = $1
     GROUP BY resource_type
     ORDER BY utilization_rate DESC`,
    [institutionId],
  );

  return result.rows.map((row) => ({
    resourceType: row.resource_type as string,
    totalUnits: Number(row.total_units),
    inUse: Number(row.in_use),
    available: Number(row.available),
    utilizationRate: Number(row.utilization_rate),
  }));
}

/**
 * Update resource counts for an institution.
 */
export async function updateResourceAllocation(
  institutionId: string,
  resourceType: string,
  totalUnits: number,
  inUse: number,
): Promise<void> {
  await query(
    `INSERT INTO institution_resources (id, institution_id, resource_type, total_units, in_use, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (institution_id, resource_type)
     DO UPDATE SET total_units = $4, in_use = $5, updated_at = NOW()`,
    [uuidv4(), institutionId, resourceType, totalUnits, inUse],
  );
}

// ---------------------------------------------------------------------------
// Occupancy tracking
// ---------------------------------------------------------------------------

/**
 * Update the occupancy of an institution and/or department.
 */
export async function updateOccupancy(
  institutionId: string,
  departmentId?: string,
  change = 1,
): Promise<void> {
  await withTransaction(async (client) => {
    // Update institution-level occupancy
    await client.query(
      `UPDATE institutions
       SET current_occupancy = GREATEST(0, COALESCE(current_occupancy, 0) + $2),
           updated_at = NOW()
       WHERE id = $1`,
      [institutionId, change],
    );

    // Update department-level occupancy if specified
    if (departmentId) {
      await client.query(
        `UPDATE departments
         SET current_occupancy = GREATEST(0, COALESCE(current_occupancy, 0) + $2)
         WHERE id = $1`,
        [departmentId, change],
      );
    }
  });

  logger.debug({ institutionId, departmentId, change }, 'Occupancy updated');
}

/**
 * Get real-time occupancy overview for an institution.
 */
export async function getOccupancyOverview(institutionId: string): Promise<{
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  departments: Array<{
    name: string;
    beds: number;
    occupied: number;
    rate: number;
  }>;
}> {
  const instResult = await query(
    `SELECT bed_capacity, current_occupancy FROM institutions WHERE id = $1`,
    [institutionId],
  );

  if (instResult.rows.length === 0) {
    throw new Error('Institution not found');
  }

  const totalBeds = Number(instResult.rows[0].bed_capacity ?? 0);
  const occupiedBeds = Number(instResult.rows[0].current_occupancy ?? 0);

  const deptResult = await query(
    `SELECT name, bed_count, current_occupancy FROM departments WHERE institution_id = $1 ORDER BY name`,
    [institutionId],
  );

  return {
    totalBeds,
    occupiedBeds,
    availableBeds: Math.max(0, totalBeds - occupiedBeds),
    occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0,
    departments: deptResult.rows.map((row) => {
      const beds = Number(row.bed_count ?? 0);
      const occupied = Number(row.current_occupancy ?? 0);
      return {
        name: row.name as string,
        beds,
        occupied,
        rate: beds > 0 ? Math.round((occupied / beds) * 1000) / 10 : 0,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapInstitutionRow(row: Record<string, unknown>): InstitutionRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    tier: row.tier as string,
    region: row.region as string,
    city: row.city as string,
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    bedCapacity: (row.bed_capacity as number) ?? null,
    currentOccupancy: (row.current_occupancy as number) ?? null,
    specialties: (row.specialties as string[]) ?? [],
    equipment: (row.equipment as string[]) ?? [],
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}

function mapDepartmentRow(row: Record<string, unknown>): DepartmentRecord {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    name: row.name as string,
    headDoctorId: (row.head_doctor_id as string) ?? null,
    bedCount: Number(row.bed_count ?? 0),
    currentOccupancy: Number(row.current_occupancy ?? 0),
  };
}
