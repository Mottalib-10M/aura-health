export const typeDefs = /* GraphQL */ `
  # ─────────────────────────────────────────────
  # Enums
  # ─────────────────────────────────────────────

  enum UserRole {
    PATIENT
    DOCTOR
    HOSPITAL_ADMIN
    ANALYST
    SYSTEM_ADMIN
  }

  enum UrgencyLevel {
    EMERGENCY
    URGENT
    SEMI_URGENT
    NON_URGENT
  }

  enum VerificationStatus {
    PENDING
    IN_REVIEW
    VERIFIED
    REJECTED
    SUSPENDED
  }

  enum AppointmentStatus {
    SCHEDULED
    CONFIRMED
    CHECKED_IN
    IN_PROGRESS
    COMPLETED
    CANCELLED
    NO_SHOW
  }

  enum InstitutionType {
    HOSPITAL
    CLINIC
    POLYCLINIC
    DIAGNOSTIC_CENTER
    PHARMACY
    REHABILITATION_CENTER
  }

  enum InstitutionTier {
    PRIMARY
    SECONDARY
    TERTIARY
    QUATERNARY
  }

  enum AlertLevel {
    WATCH
    WARNING
    ALERT
    EMERGENCY
  }

  # ─────────────────────────────────────────────
  # Core Types
  # ─────────────────────────────────────────────

  type Patient {
    id: ID!
    auraId: String!
    firstName: String
    lastName: String
    dateOfBirth: String
    gender: String
    bloodType: String
    region: String!
    city: String!
    language: String
    publicKey: String
    createdAt: String!
    updatedAt: String!
    telemetrySummary: TelemetrySummary
    appointments: [Appointment!]!
    prescriptions: [Prescription!]!
    triageHistory: [TriageEvent!]!
  }

  type Doctor {
    id: ID!
    firstName: String!
    lastName: String!
    licenseNumber: String!
    specialty: String!
    subspecialty: String
    institution: Institution
    institutionId: ID
    verificationStatus: VerificationStatus!
    efficacyScore: Float
    satisfactionScore: Float
    consultationCount: Int!
    region: String!
    languages: [String!]!
    availableSlots: [TimeSlot!]
    createdAt: String!
    updatedAt: String!
  }

  type Institution {
    id: ID!
    name: String!
    type: InstitutionType!
    tier: InstitutionTier!
    region: String!
    city: String!
    latitude: Float
    longitude: Float
    bedCapacity: Int
    currentOccupancy: Int
    specialties: [String!]!
    equipment: [String!]!
    departments: [Department!]
    createdAt: String!
    updatedAt: String!
  }

  type Department {
    id: ID!
    name: String!
    headDoctorId: ID
    bedCount: Int
    currentOccupancy: Int
  }

  type Appointment {
    id: ID!
    patient: Patient!
    patientId: ID!
    doctor: Doctor!
    doctorId: ID!
    institutionId: ID
    scheduledAt: String!
    durationMinutes: Int!
    status: AppointmentStatus!
    checkInCode: String
    estimatedWait: Int
    reason: String
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  type TriageEvent {
    id: ID!
    patient: Patient
    patientId: ID!
    symptoms: [String!]!
    symptomDescription: String!
    urgencyLevel: UrgencyLevel!
    confidenceScore: Float!
    recommendedSpecializations: [String!]!
    redFlags: [String!]!
    suggestedDiagnostics: [String!]!
    differentialDiagnoses: [DiagnosisEntry!]!
    modelUsed: String!
    responseLatencyMs: Int!
    followUpScheduled: Boolean!
    createdAt: String!
  }

  type DiagnosisEntry {
    code: String!
    name: String!
    probability: Float!
  }

  type Prescription {
    id: ID!
    patient: Patient!
    patientId: ID!
    doctor: Doctor!
    doctorId: ID!
    diagnosisCodes: [String!]!
    medications: [Medication!]!
    outcomeAssessment: String
    efficacyScore: Float
    sideEffectsReported: [String!]
    followUpDate: String
    createdAt: String!
    updatedAt: String!
  }

  type Medication {
    drugName: String!
    dosage: String!
    frequency: String!
    durationDays: Int!
    route: String!
    instructions: String
  }

  type TelemetrySummary {
    latestHeartRate: Float
    latestSpO2: Float
    averageHeartRate: Float
    averageSpO2: Float
    hrvMean: Float
    hrvSdnn: Float
    hrvRmssd: Float
    lastUpdated: String
    alertsActive: [TelemetryAlert!]
  }

  type TelemetryAlert {
    metric: String!
    value: Float!
    threshold: Float!
    severity: String!
    detectedAt: String!
  }

  # ─────────────────────────────────────────────
  # Surveillance & Analytics Types
  # ─────────────────────────────────────────────

  type SurveillanceData {
    id: ID!
    region: String!
    city: String!
    diseaseCode: String!
    diseaseName: String
    caseCount: Int!
    deathCount: Int!
    recoveredCount: Int!
    testPositivityRate: Float!
    alertLevel: AlertLevel!
    reportDate: String!
    dataSource: String
  }

  type OutbreakAlert {
    id: ID!
    region: String!
    city: String
    diseaseCode: String!
    diseaseName: String!
    alertLevel: AlertLevel!
    caseCount: Int!
    growthRate: Float!
    detectionMethod: String!
    message: String!
    recommendations: [String!]!
    isActive: Boolean!
    declaredAt: String!
    resolvedAt: String
  }

  type EfficacyMetric {
    id: ID!
    drugName: String!
    dosage: String!
    diagnosisCode: String!
    cohortSize: Int!
    outcomeMetrics: OutcomeMetrics!
    comparativeEffectiveness: Float
    region: String
    timeframeMonths: Int!
    lastUpdated: String!
  }

  type OutcomeMetrics {
    remissionRate: Float!
    averageDaysToImprovement: Float!
    sideEffectRate: Float!
    readmissionRate: Float!
    patientSatisfaction: Float
  }

  type SupplyForecast {
    id: ID!
    pharmaceuticalId: String!
    pharmaceuticalName: String!
    region: String!
    currentStock: Int!
    dailyConsumptionRate: Float!
    forecastedDemand: Int!
    daysUntilStockout: Int!
    reorderPoint: Int!
    suggestedOrderQuantity: Int!
    confidence: Float!
    forecastDate: String!
  }

  type TimeSlot {
    startTime: String!
    endTime: String!
    isAvailable: Boolean!
  }

  # ─────────────────────────────────────────────
  # Input Types
  # ─────────────────────────────────────────────

  input SymptomTriageInput {
    patientId: ID!
    symptoms: [String!]!
    symptomDescription: String!
    duration: String
    severity: Int
    vitalSigns: VitalSignsInput
    language: String
  }

  input VitalSignsInput {
    heartRate: Float
    bloodPressureSystolic: Float
    bloodPressureDiastolic: Float
    temperature: Float
    respiratoryRate: Float
    spO2: Float
  }

  input CreateAppointmentInput {
    patientId: ID!
    doctorId: ID
    institutionId: ID
    specialty: String!
    preferredDate: String
    preferredTimeStart: String
    preferredTimeEnd: String
    urgencyLevel: UrgencyLevel
    reason: String
  }

  input RecordPrescriptionOutcomeInput {
    prescriptionId: ID!
    outcomeAssessment: String!
    efficacyScore: Float!
    sideEffectsReported: [String!]
    followUpRequired: Boolean
  }

  input RegisterPatientInput {
    firstName: String!
    lastName: String!
    dateOfBirth: String!
    gender: String!
    bloodType: String
    region: String!
    city: String!
    language: String
    phone: String
    email: String
  }

  input RegisterDoctorInput {
    firstName: String!
    lastName: String!
    licenseNumber: String!
    specialty: String!
    subspecialty: String
    institutionId: ID
    region: String!
    languages: [String!]!
    credentialDocumentUrl: String
  }

  input DateRangeInput {
    startDate: String!
    endDate: String!
  }

  input UpdateVerificationStatusInput {
    doctorId: ID!
    status: VerificationStatus!
    notes: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input UpdatePatientInput {
    patientId: ID!
    firstName: String
    lastName: String
    phone: String
    email: String
    language: String
    city: String
  }

  input TelemetryInput {
    patientId: ID!
    metricType: String!
    value: Float!
    deviceId: String
    recordedAt: String
  }

  input ScheduleInput {
    doctorId: ID!
    dayOfWeek: Int!
    startTime: String!
    endTime: String!
    isAvailable: Boolean!
  }

  input SurveillanceInput {
    region: String!
    city: String!
    diseaseCode: String!
    diseaseName: String!
    caseCount: Int!
    deathCount: Int!
    recoveredCount: Int!
    testPositivityRate: Float!
    reportDate: String!
    dataSource: String
  }

  # ─────────────────────────────────────────────
  # Response Types
  # ─────────────────────────────────────────────

  type TriageOutput {
    triageEventId: ID!
    urgencyLevel: UrgencyLevel!
    confidenceScore: Float!
    recommendedSpecializations: [String!]!
    redFlags: [String!]!
    suggestedDiagnostics: [String!]!
    differentialDiagnoses: [DiagnosisEntry!]!
    patientGuidance: String!
    followUpRecommended: Boolean!
    modelUsed: String!
    responseLatencyMs: Int!
  }

  type AppointmentResult {
    appointment: Appointment!
    alternativeSlots: [TimeSlot!]
    estimatedWaitMinutes: Int
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: UserInfo!
  }

  type UserInfo {
    id: ID!
    role: UserRole!
    auraId: String
  }

  type LongitudinalResult {
    patientId: ID!
    windowDays: Int!
    trends: [TrendEntry!]!
    summary: String
  }

  type TrendEntry {
    metric: String!
    values: [Float!]!
    dates: [String!]!
    trend: String!
  }

  type TelemetryData {
    patientId: ID!
    days: Int!
    heartRateAvg: Float
    spO2Avg: Float
    readings: [TelemetryReading!]!
  }

  type TelemetryReading {
    metricType: String!
    value: Float!
    recordedAt: String!
  }

  # ─────────────────────────────────────────────
  # Queries
  # ─────────────────────────────────────────────

  type Query {
    # Patient
    patient(id: ID!): Patient
    patientByAuraId(auraId: String!): Patient

    # Doctor
    doctor(id: ID!): Doctor
    doctorsBySpecialty(specialty: String!, region: String): [Doctor!]!

    # Institution
    institution(id: ID!): Institution
    institutions(region: String, type: InstitutionType, tier: InstitutionTier): [Institution!]!

    # Appointments
    appointment(id: ID!): Appointment
    patientAppointments(patientId: ID!, status: AppointmentStatus): [Appointment!]!
    doctorAppointments(doctorId: ID!, date: String): [Appointment!]!

    # Surveillance & Analytics
    surveillanceData(region: String!, dateRange: DateRangeInput): [SurveillanceData!]!
    outbreakAlerts(region: String): [OutbreakAlert!]!
    efficacyMetrics(drugName: String, diagnosisCode: String): [EfficacyMetric!]!
    supplyForecast(pharmaceuticalId: String!): SupplyForecast

    # Triage History
    triageHistory(patientId: ID!): [TriageEvent!]!

    # Doctor schedule
    doctorSchedule(doctorId: ID!, date: String!): [TimeSlot!]!

    # Patient telemetry
    patientTelemetry(patientId: ID!, days: Int!): TelemetryData!
  }

  # ─────────────────────────────────────────────
  # Mutations
  # ─────────────────────────────────────────────

  type Mutation {
    # Triage
    submitSymptomTriage(input: SymptomTriageInput!): TriageOutput!

    # Appointments
    createAppointment(input: CreateAppointmentInput!): AppointmentResult!
    cancelAppointment(appointmentId: ID!, reason: String): Appointment!
    checkInAppointment(appointmentId: ID!, checkInCode: String!): Appointment!

    # Prescriptions
    recordPrescriptionOutcome(input: RecordPrescriptionOutcomeInput!): Prescription!

    # Registration
    registerPatient(input: RegisterPatientInput!): AuthPayload!
    registerDoctor(input: RegisterDoctorInput!): AuthPayload!

    # Admin
    updateVerificationStatus(input: UpdateVerificationStatusInput!): Doctor!

    # Authentication
    login(input: LoginInput!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!

    # Patient profile
    updatePatientProfile(input: UpdatePatientInput!): Patient!

    # Telemetry
    ingestTelemetry(input: TelemetryInput!): Boolean!

    # Longitudinal analysis
    analyzeLongitudinalHealth(patientId: ID!, windowDays: Int!): LongitudinalResult!

    # Doctor schedule management
    manageDoctorSchedule(input: ScheduleInput!): Boolean!

    # Surveillance
    ingestSurveillanceData(input: SurveillanceInput!): Boolean!
  }
`;
