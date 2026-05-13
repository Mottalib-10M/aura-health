// ---------------------------------------------------------------------------
// GraphQL Query Definitions
// ---------------------------------------------------------------------------

// ---- Authentication -------------------------------------------------------

export const GET_CURRENT_USER = /* GraphQL */ `
  query GetCurrentUser {
    me {
      id
      email
      firstName
      lastName
      role
      avatarUrl
      preferredLanguage
      institutionId
    }
  }
`;

// ---- Patient Queries ------------------------------------------------------

export const GET_PATIENT_DASHBOARD = /* GraphQL */ `
  query GetPatientDashboard($patientId: ID!) {
    patient(id: $patientId) {
      id
      firstName
      lastName
      demographic {
        age
        sex
      }
      medicalConditions {
        name
        status
        severity
      }
      currentMedications {
        drugName
        dosage
        frequency
      }
    }
    patientVitals(patientId: $patientId, last: 50) {
      heartRate { timestamp value }
      spO2 { timestamp value }
      hrvMs { timestamp value }
      steps { timestamp value }
      sleepHours { timestamp value }
    }
    patientAnomalies(patientId: $patientId, status: ACTIVE) {
      id
      metricName
      severity
      observedValue
      expectedRange { min max }
      possibleCauses
      timestamp
    }
    upcomingAppointments(patientId: $patientId, limit: 5) {
      id
      doctorName
      specialty
      scheduledStart
      scheduledEnd
      appointmentType
      status
    }
    triageHistory(patientId: $patientId, limit: 3) {
      id
      urgencyLevel
      status
      createdAt
    }
  }
`;

export const GET_PATIENT_VITALS = /* GraphQL */ `
  query GetPatientVitals($patientId: ID!, $from: DateTime, $to: DateTime) {
    patientVitals(patientId: $patientId, from: $from, to: $to) {
      heartRate { timestamp value }
      spO2 { timestamp value }
      hrvMs { timestamp value }
      steps { timestamp value }
      sleepHours { timestamp value }
      bloodGlucose { timestamp value }
    }
  }
`;

export const GET_PATIENT_APPOINTMENTS = /* GraphQL */ `
  query GetPatientAppointments($patientId: ID!, $status: AppointmentStatus, $limit: Int, $offset: Int) {
    appointments(patientId: $patientId, status: $status, limit: $limit, offset: $offset) {
      items {
        id
        doctorId
        doctorName
        appointmentType
        status
        priority
        scheduledStart
        scheduledEnd
        reasonForVisit
      }
      totalCount
    }
  }
`;

// ---- Triage Queries -------------------------------------------------------

export const GET_TRIAGE_SESSION = /* GraphQL */ `
  query GetTriageSession($sessionId: ID!) {
    triageSession(id: $sessionId) {
      id
      patientId
      status
      input {
        symptomDescription
        symptomDurationHours
        severityScale
      }
      output {
        urgencyLevel
        recommendedSpecializations {
          specialty
          confidenceScore
          rationale
          estimatedWaitTimeMinutes
        }
        redFlags
        suggestedDiagnostics
        contraindications
        epidemiologicalContext
        followUpProtocol {
          timeframeHours
          escalationTriggers
        }
      }
      modelVersion
      createdAt
      completedAt
    }
  }
`;

export const GET_TRIAGE_HISTORY = /* GraphQL */ `
  query GetTriageHistory($patientId: ID!, $limit: Int, $offset: Int) {
    triageHistory(patientId: $patientId, limit: $limit, offset: $offset) {
      items {
        id
        urgencyLevel
        status
        output {
          urgencyLevel
          recommendedSpecializations {
            specialty
            confidenceScore
          }
        }
        createdAt
      }
      totalCount
    }
  }
`;

// ---- Doctor Queries -------------------------------------------------------

export const GET_DOCTOR_DASHBOARD = /* GraphQL */ `
  query GetDoctorDashboard($doctorId: ID!, $date: Date!) {
    doctor(id: $doctorId) {
      id
      firstName
      lastName
      primarySpecialty
      performanceMetrics {
        patientSatisfactionScore
        averageConsultationMinutes
        totalConsultations30d
      }
    }
    doctorSchedule(doctorId: $doctorId, date: $date) {
      appointments {
        id
        patientId
        patientName
        patientAge
        scheduledStart
        scheduledEnd
        reasonForVisit
        priority
        status
        triageSummary {
          urgencyLevel
          recommendedSpecializations
        }
        vitalSnapshot {
          heartRate
          spO2
          temperature
        }
      }
    }
    doctorStats(doctorId: $doctorId) {
      patientsToday
      avgConsultationTime
      satisfactionScore
      pendingFollowUps
    }
  }
`;

export const GET_DOCTOR_PATIENTS = /* GraphQL */ `
  query GetDoctorPatients($doctorId: ID!, $search: String, $limit: Int, $offset: Int) {
    doctorPatients(doctorId: $doctorId, search: $search, limit: $limit, offset: $offset) {
      items {
        id
        firstName
        lastName
        age
        sex
        lastVisitDate
        activeConditionsCount
        riskScore
      }
      totalCount
    }
  }
`;

export const GET_PRESCRIPTION_EFFICACY = /* GraphQL */ `
  query GetPrescriptionEfficacy($doctorId: ID!, $drugName: String, $diagnosisCode: String, $from: Date, $to: Date) {
    prescriptionEfficacy(doctorId: $doctorId, drugName: $drugName, diagnosisCode: $diagnosisCode, from: $from, to: $to) {
      items {
        drugName
        diagnosisCode
        diagnosisName
        cohortSize
        resolutionRate
        averageTimeToImprovementDays
        confidenceInterval { lower upper }
        comparisonVsFirstLine { difference pValue }
        comparisonVsRegionalAvg { difference pValue }
        trend { timestamp value }
      }
      totalCount
    }
  }
`;

// ---- Hospital Queries -----------------------------------------------------

export const GET_HOSPITAL_DASHBOARD = /* GraphQL */ `
  query GetHospitalDashboard($institutionId: ID!) {
    institution(id: $institutionId) {
      id
      name
      type
      status
      metrics {
        currentPatientCount
        emergencyQueueLength
        averageWaitTimeMinutes
        bedOccupancyRate
        staffOnDuty
        ambulancesAvailable
      }
      bedCapacity {
        wardType
        totalBeds
        occupiedBeds
        availableBeds
        reservedBeds
      }
      departments {
        id
        name
        specialty
        isActive
      }
    }
    hospitalKpis(institutionId: $institutionId) {
      occupancyPercent
      staffingRatio
      revenueMonth
      revenueTrend { timestamp value }
      patientSatisfaction
      avgLengthOfStay
    }
    aiRecommendations(institutionId: $institutionId) {
      id
      type
      title
      description
      priority
      estimatedImpact
      createdAt
    }
  }
`;

// ---- Surveillance / Analyst Queries ---------------------------------------

export const GET_SURVEILLANCE_DASHBOARD = /* GraphQL */ `
  query GetSurveillanceDashboard($region: String, $dateFrom: Date, $dateTo: Date) {
    outbreakSummaries(region: $region, dateFrom: $dateFrom, dateTo: $dateTo) {
      id
      diseaseName
      alertLevel
      status
      totalCases
      affectedRegionsCount
      growthRate
      lastUpdated
    }
    alertLevelCounts(region: $region) {
      watch
      warning
      alert
      emergency
    }
    diseaseHeatmap(region: $region, dateFrom: $dateFrom, dateTo: $dateTo) {
      features {
        coordinates { latitude longitude }
        caseCount
        diseaseName
        alertLevel
      }
    }
    populationHealthKpis(region: $region) {
      incidenceRate
      mortalityRate
      vaccinationCoverage
      surveillanceCoverage
      reportingCompleteness
    }
  }
`;

export const GET_OUTBREAK_DETAILS = /* GraphQL */ `
  query GetOutbreakDetails($outbreakId: ID!) {
    outbreak(id: $outbreakId) {
      id
      diseaseName
      icd10Code
      pathogenType
      alertLevel
      status
      totalCases
      totalDeaths
      caseFatalityRate
      reproductiveNumber
      clusters {
        region
        city
        caseCount
        firstCaseDate
        latestCaseDate
        growthRate
        coordinates { latitude longitude }
      }
      affectedRegions
      containmentMeasures
      firstReported
      lastUpdated
      whoNotified
      notes
    }
    outbreakTimeSeries(outbreakId: $outbreakId) {
      daily {
        date
        newCases
        cumulativeCases
        newDeaths
      }
    }
  }
`;

export const GET_SUPPLY_CHAIN = /* GraphQL */ `
  query GetSupplyChain($region: String, $stockLevel: StockLevel, $minCriticality: Float) {
    supplyForecasts(region: $region, stockLevel: $stockLevel, minCriticality: $minCriticality) {
      items {
        pharmaceuticalId
        drugName
        currentStock {
          units
          daysOfSupplyRemaining
          warehouseDistribution
        }
        demandForecast {
          model
          horizonMonths
          predictions { month units confidence }
        }
        riskAssessment {
          stockoutProbability
          criticalityScore
          alternativeAvailability
        }
        recommendedOrders {
          supplier
          quantity
          orderDate
          estimatedDelivery
        }
      }
      totalCount
    }
    regionalSupplyStatus(region: $region) {
      items {
        pharmaceuticalId
        drugName
        region
        stockLevel
        daysRemaining
      }
    }
  }
`;

export const GET_OUTBREAK_TRENDS = /* GraphQL */ `
  query GetOutbreakTrends($diseaseName: String!, $region: String, $from: Date!, $to: Date!) {
    outbreakTrends(diseaseName: $diseaseName, region: $region, from: $from, to: $to) {
      timeSeries {
        date
        newCases
        cumulativeCases
        movingAverage7d
        threshold
      }
      alertLevels {
        date
        level
      }
    }
  }
`;
