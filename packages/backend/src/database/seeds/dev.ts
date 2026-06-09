/**
 * Development seed data for Uzavita Platform.
 * Populates the database with realistic sample data for Uzbekistan,
 * Kyrgyzstan, and Tajikistan.
 *
 * Usage: npx tsx src/database/seeds/dev.ts
 */

import { pool, query, withTransaction } from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const REGIONS = {
  uz: [
    { region: 'Tashkent', cities: ['Tashkent', 'Chirchiq', 'Olmaliq', 'Angren'] },
    { region: 'Samarkand', cities: ['Samarkand', 'Kattaqurgan', 'Urgut'] },
    { region: 'Bukhara', cities: ['Bukhara', 'Kogon', 'Gazli'] },
    { region: 'Fergana', cities: ['Fergana', 'Margilan', 'Quvasoy'] },
    { region: 'Karakalpakstan', cities: ['Nukus', 'Kungrad', 'Turtkul'] },
  ],
  kg: [
    { region: 'Bishkek', cities: ['Bishkek', 'Kara-Balta'] },
    { region: 'Osh', cities: ['Osh', 'Kara-Suu'] },
    { region: 'Issyk-Kul', cities: ['Karakol', 'Balykchy'] },
  ],
  tj: [
    { region: 'Dushanbe', cities: ['Dushanbe', 'Vahdat'] },
    { region: 'Sughd', cities: ['Khujand', 'Isfara', 'Istaravshan'] },
    { region: 'Khatlon', cities: ['Bokhtar', 'Kulob', 'Danghara'] },
  ],
};

const SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Pulmonology',
  'Endocrinology',
  'Gastroenterology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Obstetrics',
  'Dermatology',
  'Ophthalmology',
  'Psychiatry',
  'Urology',
  'Oncology',
  'Infectious Disease',
];

const FIRST_NAMES_UZ = ['Aziz', 'Bobur', 'Dilshod', 'Farrukh', 'Gulnora', 'Hulkar', 'Ilhom', 'Jasur', 'Kamola', 'Laziz', 'Madina', 'Nodir', 'Ozoda', 'Parviz', 'Rustam', 'Sarvar', 'Tohir', 'Umida', 'Valijon', 'Yulduz', 'Zarina'];
const LAST_NAMES_UZ = ['Abdullayev', 'Bobojonov', 'Choriyev', 'Davlatov', 'Ergashev', 'Fayzullayev', 'Ganiyev', 'Hamidov', 'Ismoilov', 'Jurayev', 'Karimov', 'Latipov', 'Mirzayev', 'Nazarov', 'Odiljonov', 'Pulatov', 'Rakhimov', 'Saidov', 'Tursunov', 'Umarov'];

const FIRST_NAMES_KG = ['Aizhan', 'Baktygul', 'Chyngyz', 'Dastan', 'Elmira', 'Farida', 'Gulbarchyn', 'Iskender', 'Janar', 'Kubat', 'Meerim', 'Nurzhan', 'Orozbek', 'Saltanat'];
const LAST_NAMES_KG = ['Abdyldayev', 'Bakytov', 'Dosaliyev', 'Esengulova', 'Isakov', 'Kadyrova', 'Mamytov', 'Nurmatov', 'Osmonov', 'Sadykov'];

const FIRST_NAMES_TJ = ['Abdullo', 'Bahrom', 'Dildora', 'Firdavs', 'Gulrukhsor', 'Habibullo', 'Ismoil', 'Jamshed', 'Komiljon', 'Lola', 'Muhammadjon', 'Nasiba'];
const LAST_NAMES_TJ = ['Abdulloev', 'Boboyev', 'Davlatov', 'Ghanieva', 'Hakimov', 'Iskandarov', 'Juraev', 'Kamolov', 'Mirzoev', 'Nazarov'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomDob(): string {
  const start = new Date(1950, 0, 1);
  const end = new Date(2005, 11, 31);
  return randomDate(start, end).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedInstitutions(): Promise<string[]> {
  const ids: string[] = [];

  const institutionDefs = [
    // Uzbekistan
    { name: 'Republican Specialized Scientific-Practical Medical Center of Therapy and Medical Rehabilitation', type: 'HOSPITAL', tier: 'QUATERNARY', region: 'Tashkent', city: 'Tashkent', beds: 800, lat: 41.2995, lng: 69.2401 },
    { name: 'Tashkent City Clinical Hospital #1', type: 'HOSPITAL', tier: 'TERTIARY', region: 'Tashkent', city: 'Tashkent', beds: 500, lat: 41.3111, lng: 69.2797 },
    { name: 'Samarkand Regional Medical Center', type: 'HOSPITAL', tier: 'TERTIARY', region: 'Samarkand', city: 'Samarkand', beds: 350, lat: 39.6542, lng: 66.9597 },
    { name: 'Fergana Valley Polyclinic', type: 'POLYCLINIC', tier: 'SECONDARY', region: 'Fergana', city: 'Fergana', beds: 100, lat: 40.3842, lng: 71.7892 },
    { name: 'Bukhara Diagnostic Center', type: 'DIAGNOSTIC_CENTER', tier: 'SECONDARY', region: 'Bukhara', city: 'Bukhara', beds: 50, lat: 39.7747, lng: 64.4286 },
    { name: 'Nukus City Hospital', type: 'HOSPITAL', tier: 'SECONDARY', region: 'Karakalpakstan', city: 'Nukus', beds: 200, lat: 42.4628, lng: 59.6003 },
    // Kyrgyzstan
    { name: 'National Hospital of the Kyrgyz Republic', type: 'HOSPITAL', tier: 'QUATERNARY', region: 'Bishkek', city: 'Bishkek', beds: 600, lat: 42.8746, lng: 74.5698 },
    { name: 'Osh Regional Medical Center', type: 'HOSPITAL', tier: 'TERTIARY', region: 'Osh', city: 'Osh', beds: 300, lat: 40.5283, lng: 72.7985 },
    { name: 'Issyk-Kul District Clinic', type: 'CLINIC', tier: 'PRIMARY', region: 'Issyk-Kul', city: 'Karakol', beds: 60, lat: 42.4772, lng: 78.3944 },
    // Tajikistan
    { name: 'Ibn Sina National Medical Center', type: 'HOSPITAL', tier: 'QUATERNARY', region: 'Dushanbe', city: 'Dushanbe', beds: 700, lat: 38.5597, lng: 68.7870 },
    { name: 'Khujand Regional Hospital', type: 'HOSPITAL', tier: 'TERTIARY', region: 'Sughd', city: 'Khujand', beds: 250, lat: 40.2826, lng: 69.6292 },
    { name: 'Khatlon Provincial Medical Center', type: 'HOSPITAL', tier: 'SECONDARY', region: 'Khatlon', city: 'Bokhtar', beds: 180, lat: 37.8367, lng: 68.7811 },
  ];

  for (const inst of institutionDefs) {
    const id = uuidv4();
    ids.push(id);

    await query(
      `INSERT INTO institutions (id, name, type, tier, region, city, latitude, longitude, bed_capacity, current_occupancy, specialties, equipment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id, inst.name, inst.type, inst.tier, inst.region, inst.city,
        inst.lat, inst.lng, inst.beds, Math.floor(inst.beds * 0.6),
        JSON.stringify(pickN(SPECIALTIES, 6 + Math.floor(Math.random() * 6))),
        JSON.stringify(['X-Ray', 'CT Scanner', 'MRI', 'Ultrasound', 'ECG', 'Ventilator'].slice(0, 3 + Math.floor(Math.random() * 4))),
      ],
    );
  }

  logger.info({ count: ids.length }, 'Institutions seeded');
  return ids;
}

async function seedDoctors(institutionIds: string[]): Promise<string[]> {
  const ids: string[] = [];

  // Generate 60 doctors across all regions
  const allRegions = [...REGIONS.uz, ...REGIONS.kg, ...REGIONS.tj];

  for (let i = 0; i < 60; i++) {
    const regionDef = pick(allRegions);
    const isUz = REGIONS.uz.includes(regionDef);
    const isKg = REGIONS.kg.includes(regionDef);

    const firstName = isUz ? pick(FIRST_NAMES_UZ) : isKg ? pick(FIRST_NAMES_KG) : pick(FIRST_NAMES_TJ);
    const lastName = isUz ? pick(LAST_NAMES_UZ) : isKg ? pick(LAST_NAMES_KG) : pick(LAST_NAMES_TJ);

    const id = uuidv4();
    ids.push(id);

    const languages = ['uz', 'ru'];
    if (isKg) languages.push('ky');
    if (!isUz && !isKg) languages.push('tg');

    await query(
      `INSERT INTO doctors (id, first_name, last_name, license_number, specialty, institution_id, verification_status, efficacy_score, satisfaction_score, consultation_count, region, languages, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id,
        firstName,
        lastName,
        `MD-${regionDef.region.slice(0, 3).toUpperCase()}-${String(1000 + i).padStart(5, '0')}`,
        pick(SPECIALTIES),
        pick(institutionIds),
        pick(['VERIFIED', 'VERIFIED', 'VERIFIED', 'PENDING', 'IN_REVIEW']),
        Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
        Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
        Math.floor(Math.random() * 500),
        regionDef.region,
        JSON.stringify(languages),
      ],
    );

    // Create schedule for each doctor (Mon-Fri)
    for (let day = 1; day <= 5; day++) {
      await query(
        `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [uuidv4(), id, day, '09:00', '17:00'],
      );
    }
  }

  logger.info({ count: ids.length }, 'Doctors seeded');
  return ids;
}

async function seedPatients(doctorIds: string[]): Promise<string[]> {
  const ids: string[] = [];
  const allRegions = [...REGIONS.uz, ...REGIONS.kg, ...REGIONS.tj];

  // Generate 120 patients
  for (let i = 0; i < 120; i++) {
    const regionDef = pick(allRegions);
    const isUz = REGIONS.uz.includes(regionDef);
    const isKg = REGIONS.kg.includes(regionDef);

    const firstName = isUz ? pick(FIRST_NAMES_UZ) : isKg ? pick(FIRST_NAMES_KG) : pick(FIRST_NAMES_TJ);
    const lastName = isUz ? pick(LAST_NAMES_UZ) : isKg ? pick(LAST_NAMES_KG) : pick(LAST_NAMES_TJ);

    const id = uuidv4();
    ids.push(id);

    const regionCode = regionDef.region.slice(0, 3).toUpperCase();
    const auraId = `AH-${regionCode}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const city = pick(regionDef.cities);

    await query(
      `INSERT INTO patients (id, aura_id, first_name, last_name, date_of_birth, gender, blood_type, region, city, language, biometric_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())`,
      [
        id, auraId, firstName, lastName,
        randomDob(),
        pick(['male', 'female']),
        pick(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', null]),
        regionDef.region, city,
        isUz ? 'uz' : isKg ? 'ky' : 'tg',
        sha256(`${firstName}:${lastName}:${auraId}`),
      ],
    );
  }

  logger.info({ count: ids.length }, 'Patients seeded');
  return ids;
}

async function seedTelemetry(patientIds: string[]): Promise<void> {
  // Insert 24 hours of hourly telemetry for the first 20 patients
  const samplePatients = patientIds.slice(0, 20);

  for (const patientId of samplePatients) {
    const now = new Date();
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now.getTime() - hour * 60 * 60 * 1000);

      // Heart rate
      values.push(`($${paramIdx++}, $${paramIdx++}, 'heart_rate', $${paramIdx++}, $${paramIdx++})`);
      params.push(uuidv4(), patientId, 60 + Math.random() * 40, timestamp);

      // SpO2
      values.push(`($${paramIdx++}, $${paramIdx++}, 'spo2', $${paramIdx++}, $${paramIdx++})`);
      params.push(uuidv4(), patientId, 94 + Math.random() * 6, timestamp);

      // HRV
      values.push(`($${paramIdx++}, $${paramIdx++}, 'hrv', $${paramIdx++}, $${paramIdx++})`);
      params.push(uuidv4(), patientId, 20 + Math.random() * 60, timestamp);
    }

    await query(
      `INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, recorded_at)
       VALUES ${values.join(', ')}`,
      params,
    );
  }

  logger.info({ patients: samplePatients.length }, 'Telemetry data seeded');
}

async function seedSurveillanceData(): Promise<void> {
  const diseases = [
    { code: 'A09', name: 'Infectious gastroenteritis' },
    { code: 'J06', name: 'Acute upper respiratory infection' },
    { code: 'A15', name: 'Respiratory tuberculosis' },
    { code: 'B17', name: 'Acute hepatitis' },
    { code: 'A01', name: 'Typhoid fever' },
  ];

  const regions = ['Tashkent', 'Samarkand', 'Fergana', 'Bishkek', 'Osh', 'Dushanbe', 'Sughd'];

  for (const region of regions) {
    for (const disease of diseases) {
      // 90 days of data
      for (let day = 0; day < 90; day++) {
        const reportDate = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        const baseCases = 10 + Math.floor(Math.random() * 50);
        const caseCount = baseCases + (day < 14 ? Math.floor(Math.random() * 20) : 0); // Recent spike

        await query(
          `INSERT INTO surveillance_data (id, region, city, disease_code, disease_name, case_count, death_count, recovered_count, test_positivity_rate, alert_level, report_date, data_source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'MoH Sentinel', NOW())`,
          [
            uuidv4(), region, region, disease.code, disease.name,
            caseCount,
            Math.floor(caseCount * 0.01 * Math.random()),
            Math.floor(caseCount * 0.7),
            Math.round(Math.random() * 15) / 100,
            pick(['WATCH', 'WATCH', 'WARNING', 'ALERT']),
            reportDate,
          ],
        );
      }
    }
  }

  logger.info('Surveillance data seeded (90 days, 7 regions, 5 diseases)');
}

async function seedAppointmentsAndPrescriptions(
  patientIds: string[],
  doctorIds: string[],
): Promise<void> {
  // Create some appointments
  for (let i = 0; i < 40; i++) {
    const scheduledAt = randomDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    );

    await query(
      `INSERT INTO appointments (id, patient_id, doctor_id, scheduled_at, duration_minutes, status, check_in_code, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 30, $5, $6, $7, NOW(), NOW())`,
      [
        uuidv4(),
        pick(patientIds),
        pick(doctorIds),
        scheduledAt,
        pick(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'COMPLETED', 'CANCELLED']),
        String(100000 + Math.floor(Math.random() * 900000)),
        pick(['Regular checkup', 'Follow-up visit', 'New symptoms', 'Chronic disease management', 'Vaccination']),
      ],
    );
  }

  // Create some prescriptions
  const medications = [
    { drugName: 'Amoxicillin', dosage: '500mg', frequency: '3x daily', durationDays: 7, route: 'oral', instructions: 'Take with food' },
    { drugName: 'Metformin', dosage: '850mg', frequency: '2x daily', durationDays: 90, route: 'oral', instructions: 'Take with meals' },
    { drugName: 'Lisinopril', dosage: '10mg', frequency: '1x daily', durationDays: 30, route: 'oral', instructions: 'Take in the morning' },
    { drugName: 'Ibuprofen', dosage: '400mg', frequency: 'As needed', durationDays: 14, route: 'oral', instructions: 'Max 3 times daily' },
    { drugName: 'Omeprazole', dosage: '20mg', frequency: '1x daily', durationDays: 30, route: 'oral', instructions: 'Take before breakfast' },
  ];

  for (let i = 0; i < 30; i++) {
    const med = pick(medications);
    await query(
      `INSERT INTO prescriptions (id, patient_id, doctor_id, diagnosis_codes, medications, efficacy_score, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        uuidv4(),
        pick(patientIds),
        pick(doctorIds),
        [pick(['J06.9', 'E11.9', 'I10', 'M54.5', 'K21.0', 'A09.0'])],
        JSON.stringify([med]),
        Math.random() > 0.3 ? Math.round((0.4 + Math.random() * 0.6) * 100) / 100 : null,
      ],
    );
  }

  logger.info('Appointments and prescriptions seeded');
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main() {
  logger.info('Starting development seed...');

  try {
    const institutionIds = await seedInstitutions();
    const doctorIds = await seedDoctors(institutionIds);
    const patientIds = await seedPatients(doctorIds);
    await seedTelemetry(patientIds);
    await seedSurveillanceData();
    await seedAppointmentsAndPrescriptions(patientIds, doctorIds);

    logger.info('Development seed completed successfully');
  } catch (err) {
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
