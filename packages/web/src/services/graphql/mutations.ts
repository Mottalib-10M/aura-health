// ---------------------------------------------------------------------------
// GraphQL Mutation Definitions — aligned with backend schema
// ---------------------------------------------------------------------------

// ---- Authentication -------------------------------------------------------

export const LOGIN = /* GraphQL */ `
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      token
      refreshToken
      user {
        id
        role
        auraId
        email
        firstName
        lastName
        preferredLanguage
        institutionId
      }
    }
  }
`;

export const REGISTER_PATIENT = /* GraphQL */ `
  mutation RegisterPatient($input: RegisterPatientInput!) {
    registerPatient(input: $input) {
      token
      refreshToken
      user {
        id
        role
        auraId
        email
        firstName
        lastName
        preferredLanguage
      }
    }
  }
`;

export const REGISTER_DOCTOR = /* GraphQL */ `
  mutation RegisterDoctor($input: RegisterDoctorInput!) {
    registerDoctor(input: $input) {
      token
      refreshToken
      user {
        id
        role
        email
        firstName
        lastName
      }
    }
  }
`;

export const REFRESH_TOKEN = /* GraphQL */ `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
      user {
        id
        role
        auraId
      }
    }
  }
`;

// ---- Triage ---------------------------------------------------------------

export const SUBMIT_SYMPTOM_TRIAGE = /* GraphQL */ `
  mutation SubmitSymptomTriage($input: SymptomTriageInput!) {
    submitSymptomTriage(input: $input) {
      triageEventId
      urgencyLevel
      confidenceScore
      recommendedSpecializations
      redFlags
      suggestedDiagnostics
      differentialDiagnoses {
        code
        name
        probability
      }
      patientGuidance
      followUpRecommended
      modelUsed
      responseLatencyMs
    }
  }
`;

export const REVIEW_TRIAGE_EVENT = /* GraphQL */ `
  mutation ReviewTriageEvent($input: ReviewTriageInput!) {
    reviewTriageEvent(input: $input) {
      id
      urgencyLevel
      reviewedBy
      reviewedAt
      reviewNotes
      originalUrgencyLevel
    }
  }
`;

// ---- Appointments ---------------------------------------------------------

export const CREATE_APPOINTMENT = /* GraphQL */ `
  mutation CreateAppointment($input: CreateAppointmentInput!) {
    createAppointment(input: $input) {
      appointment {
        id
        patientId
        doctorId
        institutionId
        scheduledAt
        durationMinutes
        status
        checkInCode
        reason
        createdAt
      }
      alternativeSlots {
        startTime
        endTime
        isAvailable
      }
      estimatedWaitMinutes
    }
  }
`;

export const CANCEL_APPOINTMENT = /* GraphQL */ `
  mutation CancelAppointment($appointmentId: ID!, $reason: String) {
    cancelAppointment(appointmentId: $appointmentId, reason: $reason) {
      id
      status
      notes
      updatedAt
    }
  }
`;

export const CHECK_IN_APPOINTMENT = /* GraphQL */ `
  mutation CheckInAppointment($appointmentId: ID!, $checkInCode: String!) {
    checkInAppointment(appointmentId: $appointmentId, checkInCode: $checkInCode) {
      id
      status
      updatedAt
    }
  }
`;

// ---- Prescriptions --------------------------------------------------------

export const RECORD_PRESCRIPTION_OUTCOME = /* GraphQL */ `
  mutation RecordPrescriptionOutcome($input: RecordPrescriptionOutcomeInput!) {
    recordPrescriptionOutcome(input: $input) {
      id
      outcomeAssessment
      efficacyScore
      sideEffectsReported
      followUpDate
      updatedAt
    }
  }
`;

// ---- Patient Profile ------------------------------------------------------

export const UPDATE_PATIENT_PROFILE = /* GraphQL */ `
  mutation UpdatePatientProfile($input: UpdatePatientInput!) {
    updatePatientProfile(input: $input) {
      id
      auraId
      firstName
      lastName
      dateOfBirth
      gender
      bloodType
      region
      city
      language
      updatedAt
    }
  }
`;

// ---- Telemetry ------------------------------------------------------------

export const INGEST_TELEMETRY = /* GraphQL */ `
  mutation IngestTelemetry($input: TelemetryInput!) {
    ingestTelemetry(input: $input)
  }
`;

export const ANALYZE_LONGITUDINAL_HEALTH = /* GraphQL */ `
  mutation AnalyzeLongitudinalHealth($patientId: ID!, $windowDays: Int!) {
    analyzeLongitudinalHealth(patientId: $patientId, windowDays: $windowDays) {
      patientId
      windowDays
      trends {
        metric
        values
        dates
        trend
      }
      summary
    }
  }
`;

// ---- Doctor Schedule ------------------------------------------------------

export const MANAGE_DOCTOR_SCHEDULE = /* GraphQL */ `
  mutation ManageDoctorSchedule($input: ScheduleInput!) {
    manageDoctorSchedule(input: $input)
  }
`;

// ---- Admin ----------------------------------------------------------------

export const UPDATE_VERIFICATION_STATUS = /* GraphQL */ `
  mutation UpdateVerificationStatus($input: UpdateVerificationStatusInput!) {
    updateVerificationStatus(input: $input) {
      id
      firstName
      lastName
      verificationStatus
      updatedAt
    }
  }
`;

// ---- Surveillance ---------------------------------------------------------

export const INGEST_SURVEILLANCE_DATA = /* GraphQL */ `
  mutation IngestSurveillanceData($input: SurveillanceInput!) {
    ingestSurveillanceData(input: $input)
  }
`;
