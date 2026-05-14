import { query } from '../../config/database.js';
import { requireAuth, requireRole, requireOwnership, UserRole, type AuthenticatedUser } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// GraphQL context shape
// ---------------------------------------------------------------------------
export interface GraphQLContext {
  user?: AuthenticatedUser;
}

// ---------------------------------------------------------------------------
// Query resolvers
// ---------------------------------------------------------------------------
export const queryResolvers = {
  Query: {
    // ── Patient ──────────────────────────────────────────────────────
    async patient(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx.user);
      requireOwnership(ctx, id);
      const result = await query(
        `SELECT * FROM patients WHERE id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async patientByAuraId(_: unknown, { auraId }: { auraId: string }, ctx: GraphQLContext) {
      requireAuth(ctx.user);
      const result = await query(
        `SELECT * FROM patients WHERE aura_id = $1`,
        [auraId],
      );
      return result.rows[0] ?? null;
    },

    // ── Doctor ───────────────────────────────────────────────────────
    async doctor(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx.user);
      const result = await query(
        `SELECT * FROM doctors WHERE id = $1`,
        [id],
      );
      if (!result.rows[0]) return null;

      const doc = result.rows[0];
      return mapDoctorRow(doc);
    },

    async doctorsBySpecialty(
      _: unknown,
      { specialty, region }: { specialty: string; region?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      let sql = `SELECT * FROM doctors WHERE specialty = $1 AND verification_status = 'VERIFIED'`;
      const params: unknown[] = [specialty];

      if (region) {
        sql += ` AND region = $2`;
        params.push(region);
      }

      sql += ` ORDER BY efficacy_score DESC NULLS LAST LIMIT 50`;
      const result = await query(sql, params);
      return result.rows.map(mapDoctorRow);
    },

    // ── Institution ──────────────────────────────────────────────────
    async institution(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx.user);
      const result = await query(`SELECT * FROM institutions WHERE id = $1`, [id]);
      return result.rows[0] ? mapInstitutionRow(result.rows[0]) : null;
    },

    async institutions(
      _: unknown,
      { region, type, tier }: { region?: string; type?: string; tier?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (region) {
        conditions.push(`region = $${idx++}`);
        params.push(region);
      }
      if (type) {
        conditions.push(`type = $${idx++}`);
        params.push(type);
      }
      if (tier) {
        conditions.push(`tier = $${idx++}`);
        params.push(tier);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await query(
        `SELECT * FROM institutions ${where} ORDER BY name LIMIT 100`,
        params,
      );
      return result.rows.map(mapInstitutionRow);
    },

    // ── Appointments ─────────────────────────────────────────────────
    async appointment(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx.user);
      const result = await query(`SELECT * FROM appointments WHERE id = $1`, [id]);
      return result.rows[0] ? mapAppointmentRow(result.rows[0]) : null;
    },

    async patientAppointments(
      _: unknown,
      { patientId, status }: { patientId: string; status?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      requireOwnership(ctx, patientId);
      let sql = `SELECT * FROM appointments WHERE patient_id = $1`;
      const params: unknown[] = [patientId];

      if (status) {
        sql += ` AND status = $2`;
        params.push(status);
      }

      sql += ` ORDER BY scheduled_at DESC LIMIT 50`;
      const result = await query(sql, params);
      return result.rows.map(mapAppointmentRow);
    },

    async doctorAppointments(
      _: unknown,
      { doctorId, date }: { doctorId: string; date?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      let sql = `SELECT * FROM appointments WHERE doctor_id = $1`;
      const params: unknown[] = [doctorId];

      if (date) {
        sql += ` AND DATE(scheduled_at) = $2`;
        params.push(date);
      }

      sql += ` ORDER BY scheduled_at ASC LIMIT 50`;
      const result = await query(sql, params);
      return result.rows.map(mapAppointmentRow);
    },

    // ── Surveillance & Analytics ─────────────────────────────────────
    async surveillanceData(
      _: unknown,
      { region, dateRange }: { region: string; dateRange?: { startDate: string; endDate: string } },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.ANALYST, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      let sql = `SELECT * FROM surveillance_data WHERE region = $1`;
      const params: unknown[] = [region];

      if (dateRange) {
        sql += ` AND report_date >= $2 AND report_date <= $3`;
        params.push(dateRange.startDate, dateRange.endDate);
      }

      sql += ` ORDER BY report_date DESC LIMIT 500`;
      const result = await query(sql, params);
      return result.rows.map(mapSurveillanceRow);
    },

    async outbreakAlerts(
      _: unknown,
      { region }: { region?: string },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.ANALYST, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      let sql = `SELECT * FROM outbreak_alerts WHERE is_active = true`;
      const params: unknown[] = [];

      if (region) {
        sql += ` AND region = $1`;
        params.push(region);
      }

      sql += ` ORDER BY declared_at DESC LIMIT 100`;
      const result = await query(sql, params);
      return result.rows.map(mapOutbreakAlertRow);
    },

    async efficacyMetrics(
      _: unknown,
      { drugName, diagnosisCode }: { drugName?: string; diagnosisCode?: string },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.ANALYST, UserRole.SYSTEM_ADMIN, UserRole.DOCTOR);

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (drugName) {
        conditions.push(`drug_name = $${idx++}`);
        params.push(drugName);
      }
      if (diagnosisCode) {
        conditions.push(`diagnosis_code = $${idx++}`);
        params.push(diagnosisCode);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await query(
        `SELECT * FROM efficacy_metrics ${where} ORDER BY last_updated DESC LIMIT 100`,
        params,
      );
      return result.rows.map(mapEfficacyRow);
    },

    async supplyForecast(
      _: unknown,
      { pharmaceuticalId }: { pharmaceuticalId: string },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.ANALYST, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      const result = await query(
        `SELECT * FROM supply_forecasts WHERE pharmaceutical_id = $1 ORDER BY forecast_date DESC LIMIT 1`,
        [pharmaceuticalId],
      );
      return result.rows[0] ? mapSupplyForecastRow(result.rows[0]) : null;
    },

    // ── Triage History ───────────────────────────────────────────────
    async triageHistory(
      _: unknown,
      { patientId }: { patientId: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      requireOwnership(ctx, patientId);
      const result = await query(
        `SELECT * FROM triage_events WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [patientId],
      );
      return result.rows.map(mapTriageEventRow);
    },

    // ── Doctor Schedule ───────────────────────────────────────────────
    async doctorSchedule(
      _: unknown,
      { doctorId, date }: { doctorId: string; date: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      const dayOfWeek = new Date(date).getDay();
      const result = await query(
        `SELECT start_time, end_time, is_available
         FROM doctor_schedules
         WHERE doctor_id = $1 AND day_of_week = $2
         ORDER BY start_time ASC`,
        [doctorId, dayOfWeek],
      );
      return result.rows.map((row) => ({
        startTime: String(row.start_time),
        endTime: String(row.end_time),
        isAvailable: row.is_available as boolean,
      }));
    },

    // ── Patient Telemetry ─────────────────────────────────────────────
    async patientTelemetry(
      _: unknown,
      { patientId, days }: { patientId: string; days: number },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      requireOwnership(ctx, patientId);

      const result = await query(
        `SELECT metric_type, value, recorded_at
         FROM biometric_telemetry
         WHERE patient_id = $1 AND recorded_at > NOW() - ($2 || ' days')::INTERVAL
         ORDER BY recorded_at DESC
         LIMIT 1000`,
        [patientId, days],
      );

      // Calculate averages
      const hrValues = result.rows
        .filter((r) => r.metric_type === 'heart_rate')
        .map((r) => Number(r.value));
      const spo2Values = result.rows
        .filter((r) => r.metric_type === 'spo2')
        .map((r) => Number(r.value));

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      return {
        patientId,
        days,
        heartRateAvg: avg(hrValues),
        spO2Avg: avg(spo2Values),
        readings: result.rows.map((row) => ({
          metricType: row.metric_type as string,
          value: Number(row.value),
          recordedAt: (row.recorded_at as Date).toISOString(),
        })),
      };
    },
  },

  // ── Field resolvers ──────────────────────────────────────────────
  Patient: {
    async telemetrySummary(parent: { id: string }) {
      try {
        const result = await query(
          `SELECT
             (SELECT value FROM biometric_telemetry WHERE patient_id = $1 AND metric_type = 'heart_rate' ORDER BY recorded_at DESC LIMIT 1) AS latest_heart_rate,
             (SELECT value FROM biometric_telemetry WHERE patient_id = $1 AND metric_type = 'spo2' ORDER BY recorded_at DESC LIMIT 1) AS latest_spo2,
             (SELECT AVG(value) FROM biometric_telemetry WHERE patient_id = $1 AND metric_type = 'heart_rate' AND recorded_at > NOW() - INTERVAL '24 hours') AS average_heart_rate,
             (SELECT AVG(value) FROM biometric_telemetry WHERE patient_id = $1 AND metric_type = 'spo2' AND recorded_at > NOW() - INTERVAL '24 hours') AS average_spo2,
             (SELECT AVG(value) FROM biometric_telemetry WHERE patient_id = $1 AND metric_type = 'hrv' AND recorded_at > NOW() - INTERVAL '24 hours') AS hrv_mean,
             (SELECT STDDEV(value) FROM biometric_telemetry WHERE patient_id = $1 AND metric_type = 'hrv' AND recorded_at > NOW() - INTERVAL '24 hours') AS hrv_sdnn,
             (SELECT MAX(recorded_at) FROM biometric_telemetry WHERE patient_id = $1) AS last_updated`,
          [parent.id],
        );
        const row = result.rows[0];
        if (!row) return null;

        return {
          latestHeartRate: row.latest_heart_rate,
          latestSpO2: row.latest_spo2,
          averageHeartRate: row.average_heart_rate,
          averageSpO2: row.average_spo2,
          hrvMean: row.hrv_mean,
          hrvSdnn: row.hrv_sdnn,
          hrvRmssd: null, // requires separate computation
          lastUpdated: row.last_updated?.toISOString(),
          alertsActive: [],
        };
      } catch (err) {
        logger.error({ err, patientId: parent.id }, 'Failed to fetch telemetry summary');
        return null;
      }
    },

    async appointments(parent: { id: string }) {
      const result = await query(
        `SELECT * FROM appointments WHERE patient_id = $1 ORDER BY scheduled_at DESC LIMIT 20`,
        [parent.id],
      );
      return result.rows.map(mapAppointmentRow);
    },

    async prescriptions(parent: { id: string }) {
      const result = await query(
        `SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [parent.id],
      );
      return result.rows.map(mapPrescriptionRow);
    },

    async triageHistory(parent: { id: string }) {
      const result = await query(
        `SELECT * FROM triage_events WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [parent.id],
      );
      return result.rows.map(mapTriageEventRow);
    },
  },

  Appointment: {
    async patient(parent: { patientId: string }) {
      const result = await query(`SELECT * FROM patients WHERE id = $1`, [parent.patientId]);
      return result.rows[0] ?? null;
    },
    async doctor(parent: { doctorId: string }) {
      const result = await query(`SELECT * FROM doctors WHERE id = $1`, [parent.doctorId]);
      return result.rows[0] ? mapDoctorRow(result.rows[0]) : null;
    },
  },

  Prescription: {
    async patient(parent: { patientId: string }) {
      const result = await query(`SELECT * FROM patients WHERE id = $1`, [parent.patientId]);
      return result.rows[0] ?? null;
    },
    async doctor(parent: { doctorId: string }) {
      const result = await query(`SELECT * FROM doctors WHERE id = $1`, [parent.doctorId]);
      return result.rows[0] ? mapDoctorRow(result.rows[0]) : null;
    },
  },

  TriageEvent: {
    async patient(parent: { patientId: string }) {
      const result = await query(`SELECT * FROM patients WHERE id = $1`, [parent.patientId]);
      return result.rows[0] ?? null;
    },
  },
};

// ---------------------------------------------------------------------------
// Row mappers — DB snake_case → GraphQL camelCase
// ---------------------------------------------------------------------------

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

function mapInstitutionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    tier: row.tier,
    region: row.region,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    bedCapacity: row.bed_capacity,
    currentOccupancy: row.current_occupancy,
    specialties: row.specialties ?? [],
    equipment: row.equipment ?? [],
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}

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

function mapTriageEventRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    patientId: row.patient_id,
    symptoms: row.symptoms ?? [],
    symptomDescription: row.symptom_description,
    urgencyLevel: row.urgency_level,
    confidenceScore: row.confidence_score,
    recommendedSpecializations: row.recommended_specializations ?? [],
    redFlags: row.red_flags ?? [],
    suggestedDiagnostics: row.suggested_diagnostics ?? [],
    differentialDiagnoses: row.differential_diagnoses ?? [],
    modelUsed: row.model_used,
    responseLatencyMs: row.response_latency_ms,
    followUpScheduled: row.follow_up_scheduled ?? false,
    createdAt: (row.created_at as Date)?.toISOString(),
  };
}

function mapSurveillanceRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    region: row.region,
    city: row.city,
    diseaseCode: row.disease_code,
    diseaseName: row.disease_name,
    caseCount: row.case_count,
    deathCount: row.death_count,
    recoveredCount: row.recovered_count,
    testPositivityRate: row.test_positivity_rate,
    alertLevel: row.alert_level,
    reportDate: (row.report_date as Date)?.toISOString(),
    dataSource: row.data_source,
  };
}

function mapOutbreakAlertRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    region: row.region,
    city: row.city,
    diseaseCode: row.disease_code,
    diseaseName: row.disease_name,
    alertLevel: row.alert_level,
    caseCount: row.case_count,
    growthRate: row.growth_rate,
    detectionMethod: row.detection_method,
    message: row.message,
    recommendations: row.recommendations ?? [],
    isActive: row.is_active,
    declaredAt: (row.declared_at as Date)?.toISOString(),
    resolvedAt: row.resolved_at ? (row.resolved_at as Date).toISOString() : null,
  };
}

function mapEfficacyRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    drugName: row.drug_name,
    dosage: row.dosage,
    diagnosisCode: row.diagnosis_code,
    cohortSize: row.cohort_size,
    outcomeMetrics: row.outcome_metrics ?? {},
    comparativeEffectiveness: row.comparative_effectiveness,
    region: row.region,
    timeframeMonths: row.timeframe_months,
    lastUpdated: (row.last_updated as Date)?.toISOString(),
  };
}

function mapSupplyForecastRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    pharmaceuticalId: row.pharmaceutical_id,
    pharmaceuticalName: row.pharmaceutical_name,
    region: row.region,
    currentStock: row.current_stock,
    dailyConsumptionRate: row.daily_consumption_rate,
    forecastedDemand: row.forecasted_demand,
    daysUntilStockout: row.days_until_stockout,
    reorderPoint: row.reorder_point,
    suggestedOrderQuantity: row.suggested_order_quantity,
    confidence: row.confidence,
    forecastDate: (row.forecast_date as Date)?.toISOString(),
  };
}
