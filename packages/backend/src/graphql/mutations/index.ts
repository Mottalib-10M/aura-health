import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { requireAuth, requireRole, requireOwnership, signToken, signRefreshToken, verifyRefreshToken, UserRole, type AuthenticatedUser } from '../../middleware/auth.js';
import { executeTriage } from '../../services/ai/triage-engine.js';
import { scheduleAppointment } from '../../modules/appointment/index.js';
import { logger } from '../../utils/logger.js';
import { generateCheckInCode } from '../../utils/crypto.js';
import { auditPrescriptionOutcome } from '../../services/blockchain/index.js';
import { ingestSurveillanceData as ingestSurveillanceDataModule } from '../../modules/analyst/index.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface GraphQLContext {
  user?: AuthenticatedUser;
}

// ---------------------------------------------------------------------------
// Input types (mirrors SDL inputs)
// ---------------------------------------------------------------------------
interface SymptomTriageInput {
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
}

interface CreateAppointmentInput {
  patientId: string;
  doctorId?: string;
  institutionId?: string;
  specialty: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  urgencyLevel?: string;
  reason?: string;
}

interface RecordPrescriptionOutcomeInput {
  prescriptionId: string;
  outcomeAssessment: string;
  efficacyScore: number;
  sideEffectsReported?: string[];
  followUpRequired?: boolean;
}

interface RegisterPatientInput {
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
  password?: string;
}

interface CreatePatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  region: string;
  city: string;
  bloodType?: string;
  language?: string;
  email?: string;
}

interface RegisterDoctorInput {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specialty: string;
  subspecialty?: string;
  institutionId?: string;
  region: string;
  languages: string[];
  credentialDocumentUrl?: string;
  email?: string;
  password?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface UpdatePatientInput {
  patientId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  language?: string;
  city?: string;
}

interface TelemetryInput {
  patientId: string;
  metricType: string;
  value: number;
  deviceId?: string;
  recordedAt?: string;
}

interface ScheduleInput {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface SurveillanceInput {
  region: string;
  city: string;
  diseaseCode: string;
  diseaseName: string;
  caseCount: number;
  deathCount: number;
  recoveredCount: number;
  testPositivityRate: number;
  reportDate: string;
  dataSource?: string;
}

interface UpdateVerificationStatusInput {
  doctorId: string;
  status: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Mutation resolvers
// ---------------------------------------------------------------------------
export const mutationResolvers = {
  Mutation: {
    // ── Symptom Triage ────────────────────────────────────────────────
    async submitSymptomTriage(
      _: unknown,
      { input }: { input: SymptomTriageInput },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      logger.info({ patientId: input.patientId }, 'Symptom triage requested');

      const startTime = performance.now();

      // Execute AI triage pipeline
      const triageResult = await executeTriage({
        patientId: input.patientId,
        symptoms: input.symptoms,
        symptomDescription: input.symptomDescription,
        duration: input.duration,
        severity: input.severity,
        vitalSigns: input.vitalSigns,
        language: input.language ?? 'en',
      });

      const latencyMs = Math.round(performance.now() - startTime);

      // Persist triage event
      const triageEventId = uuidv4();
      await query(
        `INSERT INTO triage_events (
          id, patient_id, symptoms, symptom_description,
          urgency_level, confidence_score,
          recommended_specializations, red_flags,
          suggested_diagnostics, differential_diagnoses,
          model_used, response_latency_ms, follow_up_scheduled,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [
          triageEventId,
          input.patientId,
          JSON.stringify(input.symptoms),
          input.symptomDescription,
          triageResult.urgencyLevel,
          triageResult.confidenceScore,
          JSON.stringify(triageResult.recommendedSpecializations),
          JSON.stringify(triageResult.redFlags),
          JSON.stringify(triageResult.suggestedDiagnostics),
          JSON.stringify(triageResult.differentialDiagnoses),
          triageResult.modelUsed,
          latencyMs,
          triageResult.followUpRecommended,
        ],
      );

      logger.info(
        { triageEventId, urgency: triageResult.urgencyLevel, latencyMs },
        'Triage event persisted',
      );

      return {
        triageEventId,
        urgencyLevel: triageResult.urgencyLevel,
        confidenceScore: triageResult.confidenceScore,
        recommendedSpecializations: triageResult.recommendedSpecializations,
        redFlags: triageResult.redFlags,
        suggestedDiagnostics: triageResult.suggestedDiagnostics,
        differentialDiagnoses: triageResult.differentialDiagnoses,
        patientGuidance: triageResult.patientGuidance,
        followUpRecommended: triageResult.followUpRecommended,
        modelUsed: triageResult.modelUsed,
        responseLatencyMs: latencyMs,
      };
    },

    // ── Review Triage Event (Approve / Override) ─────────────────────
    async reviewTriageEvent(
      _: unknown,
      { input }: { input: { triageEventId: string; approved: boolean; newUrgencyLevel?: string; notes?: string } },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.DOCTOR, UserRole.SYSTEM_ADMIN);

      const existing = await query(
        `SELECT * FROM triage_events WHERE id = $1`,
        [input.triageEventId],
      );

      if (existing.rows.length === 0) {
        throw new Error('Triage event not found');
      }

      const row = existing.rows[0];

      if (input.approved) {
        // Approve: mark as reviewed, keep urgency
        await query(
          `UPDATE triage_events
           SET reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
           WHERE id = $1`,
          [input.triageEventId, ctx.user!.id, input.notes ?? 'Approved by doctor'],
        );
      } else {
        // Override: save original urgency, set new one
        const newUrgency = input.newUrgencyLevel ?? row.urgency_level;
        await query(
          `UPDATE triage_events
           SET reviewed_by = $2, reviewed_at = NOW(), review_notes = $3,
               original_urgency_level = urgency_level, urgency_level = $4
           WHERE id = $1`,
          [input.triageEventId, ctx.user!.id, input.notes ?? '', newUrgency],
        );
      }

      const updated = await query(
        `SELECT * FROM triage_events WHERE id = $1`,
        [input.triageEventId],
      );

      const t = updated.rows[0];
      logger.info(
        { triageEventId: input.triageEventId, approved: input.approved, doctorId: ctx.user!.id },
        'Triage event reviewed',
      );

      return {
        id: t.id,
        patientId: t.patient_id,
        symptoms: t.symptoms,
        symptomDescription: t.symptom_description,
        urgencyLevel: t.urgency_level,
        confidenceScore: t.confidence_score,
        recommendedSpecializations: t.recommended_specializations,
        redFlags: t.red_flags,
        suggestedDiagnostics: t.suggested_diagnostics,
        differentialDiagnoses: t.differential_diagnoses ?? [],
        modelUsed: t.model_used,
        responseLatencyMs: t.response_latency_ms,
        followUpScheduled: t.follow_up_scheduled,
        reviewedBy: t.reviewed_by,
        reviewedAt: t.reviewed_at?.toISOString?.() ?? t.reviewed_at,
        reviewNotes: t.review_notes,
        originalUrgencyLevel: t.original_urgency_level,
        createdAt: (t.created_at as Date)?.toISOString(),
      };
    },

    // ── Create Appointment ────────────────────────────────────────────
    async createAppointment(
      _: unknown,
      { input }: { input: CreateAppointmentInput },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      logger.info({ patientId: input.patientId, specialty: input.specialty }, 'Appointment creation requested');

      const result = await scheduleAppointment({
        patientId: input.patientId,
        doctorId: input.doctorId,
        institutionId: input.institutionId,
        specialty: input.specialty,
        preferredDate: input.preferredDate,
        preferredTimeStart: input.preferredTimeStart,
        preferredTimeEnd: input.preferredTimeEnd,
        urgencyLevel: input.urgencyLevel ?? 'NON_URGENT',
        reason: input.reason,
      });

      return result;
    },

    // ── Cancel Appointment ────────────────────────────────────────────
    async cancelAppointment(
      _: unknown,
      { appointmentId, reason }: { appointmentId: string; reason?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);

      const result = await query(
        `UPDATE appointments
         SET status = 'CANCELLED', notes = COALESCE(notes || E'\\n', '') || $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [appointmentId, reason ? `Cancelled: ${reason}` : 'Cancelled by user'],
      );

      if (result.rows.length === 0) {
        throw new Error('Appointment not found');
      }

      logger.info({ appointmentId }, 'Appointment cancelled');
      return mapAppointmentRow(result.rows[0]);
    },

    // ── Check-In Appointment ──────────────────────────────────────────
    async checkInAppointment(
      _: unknown,
      { appointmentId, checkInCode }: { appointmentId: string; checkInCode: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);

      const existing = await query(
        `SELECT * FROM appointments WHERE id = $1`,
        [appointmentId],
      );

      if (existing.rows.length === 0) {
        throw new Error('Appointment not found');
      }

      const appointment = existing.rows[0];

      if (appointment.check_in_code !== checkInCode) {
        throw new Error('Invalid check-in code');
      }

      if (appointment.status !== 'CONFIRMED' && appointment.status !== 'SCHEDULED') {
        throw new Error(`Cannot check in appointment with status: ${appointment.status}`);
      }

      const result = await query(
        `UPDATE appointments
         SET status = 'CHECKED_IN', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [appointmentId],
      );

      logger.info({ appointmentId }, 'Patient checked in');
      return mapAppointmentRow(result.rows[0]);
    },

    // ── Record Prescription Outcome ───────────────────────────────────
    async recordPrescriptionOutcome(
      _: unknown,
      { input }: { input: RecordPrescriptionOutcomeInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.DOCTOR, UserRole.SYSTEM_ADMIN);

      const result = await withTransaction(async (client) => {
        // Update prescription
        const updated = await client.query(
          `UPDATE prescriptions
           SET outcome_assessment = $2,
               efficacy_score = $3,
               side_effects_reported = $4,
               follow_up_date = CASE WHEN $5 THEN NOW() + INTERVAL '30 days' ELSE NULL END,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            input.prescriptionId,
            input.outcomeAssessment,
            input.efficacyScore,
            JSON.stringify(input.sideEffectsReported ?? []),
            input.followUpRequired ?? false,
          ],
        );

        if (updated.rows.length === 0) {
          throw new Error('Prescription not found');
        }

        const prescription = updated.rows[0];

        // Update the doctor's aggregate efficacy score
        await client.query(
          `UPDATE doctors
           SET efficacy_score = (
             SELECT AVG(efficacy_score)
             FROM prescriptions
             WHERE doctor_id = $1 AND efficacy_score IS NOT NULL
           ),
           updated_at = NOW()
           WHERE id = $1`,
          [prescription.doctor_id],
        );

        return prescription;
      });

      // Audit to blockchain (non-blocking)
      auditPrescriptionOutcome({
        prescriptionId: input.prescriptionId,
        efficacyScore: input.efficacyScore,
        recordedBy: ctx.user!.id,
        timestamp: new Date().toISOString(),
      }).catch((err) => {
        logger.error({ err }, 'Blockchain audit failed for prescription outcome');
      });

      logger.info({ prescriptionId: input.prescriptionId }, 'Prescription outcome recorded');
      return mapPrescriptionRow(result);
    },

    // ── Register Patient ──────────────────────────────────────────────
    async registerPatient(
      _: unknown,
      { input }: { input: RegisterPatientInput },
    ) {
      const patientId = uuidv4();
      // Generate a unique patient ID: AH-<region code>-<8 random chars>
      const regionCode = input.region.slice(0, 3).toUpperCase();
      const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
      const auraId = `AH-${regionCode}-${randomSuffix}`;

      // Hash password if provided
      const passwordHash = input.password
        ? await bcrypt.hash(input.password, 12)
        : null;

      await query(
        `INSERT INTO patients (
          id, aura_id, first_name, last_name,
          date_of_birth, gender, blood_type,
          region, city, language,
          password_hash, email,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          patientId,
          auraId,
          input.firstName,
          input.lastName,
          input.dateOfBirth,
          input.gender,
          input.bloodType ?? null,
          input.region,
          input.city,
          input.language ?? 'uz',
          passwordHash,
          input.email ?? null,
        ],
      );

      const token = signToken({ id: patientId, role: UserRole.PATIENT, auraId });
      const refreshToken = signRefreshToken({ id: patientId, role: UserRole.PATIENT });

      logger.info({ patientId, auraId, region: input.region }, 'Patient registered');

      return {
        token,
        refreshToken,
        user: {
          id: patientId,
          role: 'PATIENT',
          auraId,
        },
      };
    },

    // ── Create Patient (Doctor-initiated) ─────────────────────────────
    async createPatient(
      _: unknown,
      { input }: { input: CreatePatientInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.DOCTOR, UserRole.SYSTEM_ADMIN);

      const patientId = uuidv4();
      const regionCode = input.region.slice(0, 3).toUpperCase();
      const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
      const auraId = `AH-${regionCode}-${randomSuffix}`;

      await query(
        `INSERT INTO patients (
          id, aura_id, first_name, last_name,
          date_of_birth, gender, blood_type,
          region, city, language,
          password_hash, email, created_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12, NOW(), NOW())`,
        [
          patientId,
          auraId,
          input.firstName,
          input.lastName,
          input.dateOfBirth,
          input.gender,
          input.bloodType ?? null,
          input.region,
          input.city,
          input.language ?? 'uz',
          input.email ?? null,
          ctx.user!.id,
        ],
      );

      logger.info({ patientId, auraId, createdBy: ctx.user!.id }, 'Patient created by doctor');

      return {
        id: patientId,
        auraId,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        bloodType: input.bloodType ?? null,
        region: input.region,
        city: input.city,
        language: input.language ?? 'uz',
        publicKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        appointments: [],
        prescriptions: [],
        triageHistory: [],
      };
    },

    // ── Register Doctor ───────────────────────────────────────────────
    async registerDoctor(
      _: unknown,
      { input }: { input: RegisterDoctorInput },
    ) {
      // Check for duplicate license number
      const existing = await query(
        `SELECT id FROM doctors WHERE license_number = $1`,
        [input.licenseNumber],
      );

      if (existing.rows.length > 0) {
        throw new Error('A doctor with this license number is already registered');
      }

      const doctorId = uuidv4();

      // Hash password if provided
      const passwordHash = input.password
        ? await bcrypt.hash(input.password, 12)
        : null;

      await query(
        `INSERT INTO doctors (
          id, first_name, last_name, license_number,
          specialty, subspecialty, institution_id,
          verification_status, region, languages,
          consultation_count, password_hash, email,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, 0, $10, $11, NOW(), NOW())`,
        [
          doctorId,
          input.firstName,
          input.lastName,
          input.licenseNumber,
          input.specialty,
          input.subspecialty ?? null,
          input.institutionId ?? null,
          input.region,
          JSON.stringify(input.languages),
          passwordHash,
          input.email ?? null,
        ],
      );

      // If credential document URL is provided, store it for review
      if (input.credentialDocumentUrl) {
        await query(
          `INSERT INTO doctor_credentials (id, doctor_id, document_url, uploaded_at)
           VALUES ($1, $2, $3, NOW())`,
          [uuidv4(), doctorId, input.credentialDocumentUrl],
        );
      }

      const token = signToken({ id: doctorId, role: UserRole.DOCTOR });
      const refreshToken = signRefreshToken({ id: doctorId, role: UserRole.DOCTOR });

      logger.info({ doctorId, specialty: input.specialty, region: input.region }, 'Doctor registered');

      return {
        token,
        refreshToken,
        user: {
          id: doctorId,
          role: 'DOCTOR',
          auraId: null,
        },
      };
    },

    // ── Update Verification Status (Admin) ────────────────────────────
    async updateVerificationStatus(
      _: unknown,
      { input }: { input: UpdateVerificationStatusInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      const validStatuses = ['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'];
      if (!validStatuses.includes(input.status)) {
        throw new Error(`Invalid verification status: ${input.status}`);
      }

      const result = await query(
        `UPDATE doctors
         SET verification_status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.doctorId, input.status],
      );

      if (result.rows.length === 0) {
        throw new Error('Doctor not found');
      }

      // Log the verification action for audit trail
      await query(
        `INSERT INTO verification_audit_log (id, doctor_id, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), input.doctorId, input.status, ctx.user!.id, input.notes ?? null],
      );

      logger.info(
        { doctorId: input.doctorId, status: input.status, changedBy: ctx.user!.id },
        'Doctor verification status updated',
      );

      return mapDoctorRow(result.rows[0]);
    },

    // ── Login ─────────────────────────────────────────────────────────
    async login(
      _: unknown,
      { input }: { input: LoginInput },
    ) {
      // Try patients first, then doctors
      let userRow = await query(
        `SELECT id, password_hash, 'patient' AS role, aura_id, first_name, last_name, email, language AS preferred_language FROM patients WHERE email = $1`,
        [input.email],
      );

      let role = UserRole.PATIENT;
      let auraId: string | null = null;

      if (userRow.rows.length === 0) {
        userRow = await query(
          `SELECT id, password_hash, 'doctor' AS role, first_name, last_name, email, institution_id, languages->0 AS preferred_language FROM doctors WHERE email = $1`,
          [input.email],
        );
        role = UserRole.DOCTOR;
      }

      if (userRow.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = userRow.rows[0];
      const passwordHash = user.password_hash as string | null;

      if (!passwordHash) {
        throw new Error('Account does not have a password configured');
      }

      const valid = await bcrypt.compare(input.password, passwordHash);
      if (!valid) {
        // Increment login attempts
        if (role === UserRole.PATIENT) {
          await query(
            `UPDATE patients SET login_attempts = COALESCE(login_attempts, 0) + 1 WHERE id = $1`,
            [user.id],
          );
        }
        throw new Error('Invalid email or password');
      }

      auraId = (user.aura_id as string) ?? null;

      // Reset login attempts and update last login
      if (role === UserRole.PATIENT) {
        await query(
          `UPDATE patients SET login_attempts = 0, last_login_at = NOW() WHERE id = $1`,
          [user.id],
        );
      } else {
        await query(
          `UPDATE doctors SET last_login_at = NOW() WHERE id = $1`,
          [user.id],
        );
      }

      const token = signToken({ id: user.id as string, role, auraId: auraId ?? undefined });
      const refreshTokenValue = signRefreshToken({ id: user.id as string, role });

      logger.info({ userId: user.id, role }, 'User logged in');

      return {
        token,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          role: role === UserRole.PATIENT ? 'PATIENT' : 'DOCTOR',
          auraId,
          email: user.email as string,
          firstName: user.first_name as string,
          lastName: user.last_name as string,
          preferredLanguage: (user.preferred_language as string) ?? 'uz',
          institutionId: (user.institution_id as string) ?? null,
          avatarUrl: null,
        },
      };
    },

    // ── Refresh Token ─────────────────────────────────────────────────
    async refreshToken(
      _: unknown,
      { refreshToken: tokenValue }: { refreshToken: string },
    ) {
      try {
        const decoded = verifyRefreshToken(tokenValue);
        const userId = decoded.sub;
        const role = decoded.role;

        let auraId: string | null = null;

        if (role === UserRole.PATIENT) {
          const result = await query(`SELECT aura_id FROM patients WHERE id = $1`, [userId]);
          auraId = (result.rows[0]?.aura_id as string) ?? null;
        }

        const newToken = signToken({ id: userId, role, auraId: auraId ?? undefined });
        const newRefreshToken = signRefreshToken({ id: userId, role });

        return {
          token: newToken,
          refreshToken: newRefreshToken,
          user: {
            id: userId,
            role: role === UserRole.PATIENT ? 'PATIENT' : 'DOCTOR',
            auraId,
          },
        };
      } catch {
        throw new Error('Invalid or expired refresh token');
      }
    },

    // ── Update Patient Profile ────────────────────────────────────────
    async updatePatientProfile(
      _: unknown,
      { input }: { input: UpdatePatientInput },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      requireOwnership(ctx, input.patientId);

      const setClauses: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (input.firstName !== undefined) {
        setClauses.push(`first_name = $${idx++}`);
        params.push(input.firstName);
      }
      if (input.lastName !== undefined) {
        setClauses.push(`last_name = $${idx++}`);
        params.push(input.lastName);
      }
      if (input.language !== undefined) {
        setClauses.push(`language = $${idx++}`);
        params.push(input.language);
      }
      if (input.city !== undefined) {
        setClauses.push(`city = $${idx++}`);
        params.push(input.city);
      }
      if (input.email !== undefined) {
        setClauses.push(`email = $${idx++}`);
        params.push(input.email);
      }

      if (setClauses.length === 0) {
        throw new Error('No fields to update');
      }

      setClauses.push(`updated_at = NOW()`);
      params.push(input.patientId);

      const result = await query(
        `UPDATE patients SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        params,
      );

      if (result.rows.length === 0) {
        throw new Error('Patient not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        auraId: row.aura_id,
        firstName: row.first_name,
        lastName: row.last_name,
        dateOfBirth: row.date_of_birth?.toISOString?.() ?? row.date_of_birth,
        gender: row.gender,
        bloodType: row.blood_type,
        region: row.region,
        city: row.city,
        language: row.language,
        createdAt: (row.created_at as Date)?.toISOString(),
        updatedAt: (row.updated_at as Date)?.toISOString(),
      };
    },

    // ── Ingest Telemetry ──────────────────────────────────────────────
    async ingestTelemetry(
      _: unknown,
      { input }: { input: TelemetryInput },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);

      await query(
        `INSERT INTO biometric_telemetry (id, patient_id, metric_type, value, device_id, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          input.patientId,
          input.metricType,
          input.value,
          input.deviceId ?? null,
          input.recordedAt ? new Date(input.recordedAt) : new Date(),
        ],
      );

      logger.info({ patientId: input.patientId, metric: input.metricType }, 'Telemetry ingested');
      return true;
    },

    // ── Analyze Longitudinal Health ───────────────────────────────────
    async analyzeLongitudinalHealth(
      _: unknown,
      { patientId, windowDays }: { patientId: string; windowDays: number },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      requireOwnership(ctx, patientId);

      const result = await query(
        `SELECT metric_type, value, recorded_at
         FROM biometric_telemetry
         WHERE patient_id = $1 AND recorded_at > NOW() - ($2 || ' days')::INTERVAL
         ORDER BY metric_type, recorded_at ASC`,
        [patientId, windowDays],
      );

      // Group by metric type
      const grouped = new Map<string, { values: number[]; dates: string[] }>();
      for (const row of result.rows) {
        const mt = row.metric_type as string;
        if (!grouped.has(mt)) {
          grouped.set(mt, { values: [], dates: [] });
        }
        const g = grouped.get(mt)!;
        g.values.push(Number(row.value));
        g.dates.push((row.recorded_at as Date).toISOString());
      }

      const trends = Array.from(grouped.entries()).map(([metric, data]) => {
        // Simple trend: compare first half average to second half average
        const mid = Math.floor(data.values.length / 2);
        const firstHalf = data.values.slice(0, mid);
        const secondHalf = data.values.slice(mid);
        const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
        const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
        const trend = avgSecond > avgFirst * 1.05 ? 'increasing' : avgSecond < avgFirst * 0.95 ? 'decreasing' : 'stable';

        return { metric, values: data.values, dates: data.dates, trend };
      });

      return {
        patientId,
        windowDays,
        trends,
        summary: `Analyzed ${result.rows.length} data points across ${grouped.size} metrics over ${windowDays} days.`,
      };
    },

    // ── Manage Doctor Schedule ────────────────────────────────────────
    async manageDoctorSchedule(
      _: unknown,
      { input }: { input: ScheduleInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.DOCTOR, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      await query(
        `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (doctor_id, day_of_week, start_time)
         DO UPDATE SET end_time = EXCLUDED.end_time, is_available = EXCLUDED.is_available`,
        [
          uuidv4(),
          input.doctorId,
          input.dayOfWeek,
          input.startTime,
          input.endTime,
          input.isAvailable,
        ],
      );

      logger.info({ doctorId: input.doctorId, dayOfWeek: input.dayOfWeek }, 'Doctor schedule updated');
      return true;
    },

    // ── Ingest Surveillance Data ──────────────────────────────────────
    async ingestSurveillanceData(
      _: unknown,
      { input }: { input: SurveillanceInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.ANALYST, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      await ingestSurveillanceDataModule([{
        region: input.region,
        city: input.city,
        diseaseCode: input.diseaseCode,
        diseaseName: input.diseaseName,
        caseCount: input.caseCount,
        deathCount: input.deathCount,
        recoveredCount: input.recoveredCount,
        testPositivityRate: input.testPositivityRate,
        reportDate: input.reportDate,
        dataSource: input.dataSource,
      }]);

      logger.info({ region: input.region, diseaseCode: input.diseaseCode }, 'Surveillance data ingested via GraphQL');
      return true;
    },
  },
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapAppointmentRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    institutionId: row.institution_id,
    scheduledAt: (row.scheduled_at as Date)?.toISOString(),
    durationMinutes: row.duration_minutes ?? 30,
    status: row.status,
    checkInCode: row.check_in_code,
    estimatedWait: row.estimated_wait,
    reason: row.reason,
    notes: row.notes,
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}

function mapPrescriptionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    diagnosisCodes: row.diagnosis_codes ?? [],
    medications: row.medications ?? [],
    outcomeAssessment: row.outcome_assessment,
    efficacyScore: row.efficacy_score,
    sideEffectsReported: row.side_effects_reported ?? [],
    followUpDate: row.follow_up_date ? (row.follow_up_date as Date).toISOString() : null,
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}

function mapDoctorRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    licenseNumber: row.license_number,
    specialty: row.specialty,
    subspecialty: row.subspecialty,
    institutionId: row.institution_id,
    verificationStatus: row.verification_status,
    efficacyScore: row.efficacy_score,
    satisfactionScore: row.satisfaction_score,
    consultationCount: row.consultation_count ?? 0,
    region: row.region,
    languages: row.languages ?? [],
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}
