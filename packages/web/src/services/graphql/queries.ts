// ---------------------------------------------------------------------------
// GraphQL Query Definitions — aligned with backend schema
// ---------------------------------------------------------------------------

// ---- Authentication -------------------------------------------------------

export const GET_CURRENT_USER = /* GraphQL */ `
  query GetCurrentUser {
    me {
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
`;

// ---- Patient Queries ------------------------------------------------------

export const GET_PATIENT = /* GraphQL */ `
  query GetPatient($id: ID!) {
    patient(id: $id) {
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
      createdAt
      updatedAt
      telemetrySummary {
        latestHeartRate
        latestSpO2
        averageHeartRate
        averageSpO2
        hrvMean
        hrvSdnn
        lastUpdated
      }
      appointments {
        id
        doctorId
        scheduledAt
        durationMinutes
        status
        reason
        doctor {
          id
          firstName
          lastName
          specialty
        }
      }
      prescriptions {
        id
        doctorId
        diagnosisCodes
        medications {
          drugName
          dosage
          frequency
          durationDays
          route
          instructions
        }
        outcomeAssessment
        efficacyScore
        sideEffectsReported
        followUpDate
        createdAt
        doctor {
          id
          firstName
          lastName
          specialty
        }
      }
      triageHistory {
        id
        urgencyLevel
        confidenceScore
        symptoms
        symptomDescription
        recommendedSpecializations
        createdAt
      }
    }
  }
`;

export const GET_PATIENT_TELEMETRY = /* GraphQL */ `
  query GetPatientTelemetry($patientId: ID!, $days: Int!) {
    patientTelemetry(patientId: $patientId, days: $days) {
      patientId
      days
      heartRateAvg
      spO2Avg
      readings {
        metricType
        value
        recordedAt
      }
    }
  }
`;

export const GET_PATIENT_APPOINTMENTS = /* GraphQL */ `
  query GetPatientAppointments($patientId: ID!, $status: AppointmentStatus) {
    patientAppointments(patientId: $patientId, status: $status) {
      id
      patientId
      doctorId
      institutionId
      scheduledAt
      durationMinutes
      status
      checkInCode
      estimatedWait
      reason
      notes
      createdAt
      updatedAt
      doctor {
        id
        firstName
        lastName
        specialty
        institutionId
      }
    }
  }
`;

// ---- Triage Queries -------------------------------------------------------

export const GET_TRIAGE_HISTORY = /* GraphQL */ `
  query GetTriageHistory($patientId: ID!) {
    triageHistory(patientId: $patientId) {
      id
      patientId
      symptoms
      symptomDescription
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
      modelUsed
      responseLatencyMs
      followUpScheduled
      createdAt
      patient {
        id
        firstName
        lastName
      }
    }
  }
`;

// ---- Doctor Queries -------------------------------------------------------

export const GET_DOCTOR = /* GraphQL */ `
  query GetDoctor($id: ID!) {
    doctor(id: $id) {
      id
      firstName
      lastName
      licenseNumber
      specialty
      subspecialty
      institutionId
      verificationStatus
      efficacyScore
      satisfactionScore
      consultationCount
      region
      languages
      createdAt
      updatedAt
    }
  }
`;

export const GET_DOCTOR_APPOINTMENTS = /* GraphQL */ `
  query GetDoctorAppointments($doctorId: ID!, $date: String) {
    doctorAppointments(doctorId: $doctorId, date: $date) {
      id
      patientId
      doctorId
      institutionId
      scheduledAt
      durationMinutes
      status
      reason
      notes
      createdAt
      patient {
        id
        firstName
        lastName
        dateOfBirth
        gender
        bloodType
        region
        city
      }
    }
  }
`;

export const GET_DOCTOR_SCHEDULE = /* GraphQL */ `
  query GetDoctorSchedule($doctorId: ID!, $date: String!) {
    doctorSchedule(doctorId: $doctorId, date: $date) {
      startTime
      endTime
      isAvailable
    }
  }
`;

export const GET_DOCTOR_PATIENTS = /* GraphQL */ `
  query GetDoctorPatients($doctorId: ID!) {
    doctorPatients(doctorId: $doctorId) {
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
      createdAt
      telemetrySummary {
        latestHeartRate
        latestSpO2
        averageHeartRate
        averageSpO2
        lastUpdated
      }
      appointments {
        id
        scheduledAt
        status
        reason
      }
      prescriptions {
        id
        diagnosisCodes
        medications {
          drugName
          dosage
          frequency
        }
        createdAt
      }
      triageHistory {
        id
        urgencyLevel
        confidenceScore
        symptoms
        createdAt
      }
    }
  }
`;

export const GET_DOCTORS_BY_SPECIALTY = /* GraphQL */ `
  query GetDoctorsBySpecialty($specialty: String!, $region: String) {
    doctorsBySpecialty(specialty: $specialty, region: $region) {
      id
      firstName
      lastName
      specialty
      subspecialty
      efficacyScore
      satisfactionScore
      consultationCount
      region
      languages
    }
  }
`;

// ---- Efficacy / Prescriptions -------------------------------------------

export const GET_EFFICACY_METRICS = /* GraphQL */ `
  query GetEfficacyMetrics($drugName: String, $diagnosisCode: String) {
    efficacyMetrics(drugName: $drugName, diagnosisCode: $diagnosisCode) {
      id
      drugName
      dosage
      diagnosisCode
      cohortSize
      outcomeMetrics {
        remissionRate
        averageDaysToImprovement
        sideEffectRate
        readmissionRate
        patientSatisfaction
      }
      comparativeEffectiveness
      region
      timeframeMonths
      lastUpdated
    }
  }
`;

// ---- Institution Queries ------------------------------------------------

export const GET_INSTITUTION = /* GraphQL */ `
  query GetInstitution($id: ID!) {
    institution(id: $id) {
      id
      name
      type
      tier
      region
      city
      latitude
      longitude
      bedCapacity
      currentOccupancy
      specialties
      equipment
      createdAt
      updatedAt
    }
  }
`;

export const GET_INSTITUTIONS = /* GraphQL */ `
  query GetInstitutions($region: String, $type: InstitutionType, $tier: InstitutionTier) {
    institutions(region: $region, type: $type, tier: $tier) {
      id
      name
      type
      tier
      region
      city
      bedCapacity
      currentOccupancy
      specialties
    }
  }
`;

// ---- Surveillance / Analyst Queries -------------------------------------

export const GET_SURVEILLANCE_DATA = /* GraphQL */ `
  query GetSurveillanceData($region: String!, $dateRange: DateRangeInput) {
    surveillanceData(region: $region, dateRange: $dateRange) {
      id
      region
      city
      diseaseCode
      diseaseName
      caseCount
      deathCount
      recoveredCount
      testPositivityRate
      alertLevel
      reportDate
      dataSource
    }
  }
`;

export const GET_OUTBREAK_ALERTS = /* GraphQL */ `
  query GetOutbreakAlerts($region: String) {
    outbreakAlerts(region: $region) {
      id
      region
      city
      diseaseCode
      diseaseName
      alertLevel
      caseCount
      growthRate
      detectionMethod
      message
      recommendations
      isActive
      declaredAt
      resolvedAt
    }
  }
`;

export const GET_SUPPLY_FORECAST = /* GraphQL */ `
  query GetSupplyForecast($pharmaceuticalId: String!) {
    supplyForecast(pharmaceuticalId: $pharmaceuticalId) {
      id
      pharmaceuticalId
      pharmaceuticalName
      region
      currentStock
      dailyConsumptionRate
      forecastedDemand
      daysUntilStockout
      reorderPoint
      suggestedOrderQuantity
      confidence
      forecastDate
    }
  }
`;
