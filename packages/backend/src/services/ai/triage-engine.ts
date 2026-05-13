import { z } from 'zod';
import { query } from '../../config/database.js';
import { callModel } from './ai-router.js';
import { logger } from '../../utils/logger.js';
import { sha256 } from '../../utils/crypto.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageInput {
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
  language: string;
}

export interface TriageOutput {
  urgencyLevel: 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'NON_URGENT';
  confidenceScore: number;
  recommendedSpecializations: string[];
  redFlags: string[];
  suggestedDiagnostics: string[];
  differentialDiagnoses: Array<{ code: string; name: string; probability: number }>;
  patientGuidance: string;
  followUpRecommended: boolean;
  modelUsed: string;
}

interface PatientContext {
  age?: number;
  gender?: string;
  bloodType?: string;
  recentDiagnoses: string[];
  activeMedications: string[];
  previousTriageEvents: Array<{
    urgencyLevel: string;
    symptoms: string[];
    createdAt: string;
  }>;
  recentVitals: {
    heartRate?: number;
    spO2?: number;
    temperature?: number;
  };
}

// ---------------------------------------------------------------------------
// Zod schema for validating AI model output
// ---------------------------------------------------------------------------

const triageOutputSchema = z.object({
  urgencyLevel: z.enum(['EMERGENCY', 'URGENT', 'SEMI_URGENT', 'NON_URGENT']),
  confidenceScore: z.number().min(0).max(1),
  recommendedSpecializations: z.array(z.string()),
  redFlags: z.array(z.string()),
  suggestedDiagnostics: z.array(z.string()),
  differentialDiagnoses: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      probability: z.number().min(0).max(1),
    }),
  ),
  patientGuidance: z.string(),
  followUpRecommended: z.boolean(),
});

// ---------------------------------------------------------------------------
// Symptom preprocessing
// ---------------------------------------------------------------------------

/**
 * Normalize and extract structured information from multilingual symptom text.
 * Handles Uzbek, Russian, Kyrgyz, Tajik, and English inputs.
 */
function preprocessSymptoms(input: TriageInput): {
  normalizedSymptoms: string[];
  extractedEntities: Record<string, string>;
  languageDetected: string;
} {
  // Normalize symptom strings: trim, lowercase, remove extra whitespace
  const normalizedSymptoms = input.symptoms.map((s) =>
    s.trim().toLowerCase().replace(/\s+/g, ' '),
  );

  // Extract basic entities from the description
  const extractedEntities: Record<string, string> = {};

  // Duration extraction
  const durationMatch = input.symptomDescription.match(
    /(\d+)\s*(day|days|week|weeks|month|months|hour|hours|kun|hafta|oy|soat|день|дней|неделя|недель|месяц)/i,
  );
  if (durationMatch) {
    extractedEntities.duration = durationMatch[0];
  }

  // Severity keywords
  const severeKeywords = [
    'severe', 'intense', 'unbearable', 'worst',
    'сильный', 'интенсивный', 'нестерпимый',
    'kuchli', 'chidab bolmaydigan',
    'шиддатли',
  ];
  const hasSevereKeyword = severeKeywords.some((kw) =>
    input.symptomDescription.toLowerCase().includes(kw),
  );
  if (hasSevereKeyword) {
    extractedEntities.severityIndicator = 'high';
  }

  // Simple language detection heuristic
  let languageDetected = input.language;
  if (!languageDetected || languageDetected === 'auto') {
    const cyrillicRatio =
      (input.symptomDescription.match(/[\u0400-\u04FF]/g)?.length ?? 0) /
      Math.max(input.symptomDescription.length, 1);
    if (cyrillicRatio > 0.3) {
      // Differentiate Russian vs Uzbek-Cyrillic vs Tajik
      const uzbekCyrillicMarkers = /[ўқғҳ]/i;
      const tajikMarkers = /[ӣӯҳҷ]/i;
      if (uzbekCyrillicMarkers.test(input.symptomDescription)) {
        languageDetected = 'uz-Cyrl';
      } else if (tajikMarkers.test(input.symptomDescription)) {
        languageDetected = 'tg';
      } else {
        languageDetected = 'ru';
      }
    } else {
      languageDetected = 'en';
    }
  }

  return { normalizedSymptoms, extractedEntities, languageDetected };
}

// ---------------------------------------------------------------------------
// Patient context enrichment
// ---------------------------------------------------------------------------

async function enrichContext(patientId: string): Promise<PatientContext> {
  const context: PatientContext = {
    recentDiagnoses: [],
    activeMedications: [],
    previousTriageEvents: [],
    recentVitals: {},
  };

  try {
    // Fetch patient demographics
    const patientResult = await query(
      `SELECT date_of_birth, gender, blood_type FROM patients WHERE id = $1`,
      [patientId],
    );

    if (patientResult.rows[0]) {
      const row = patientResult.rows[0];
      if (row.date_of_birth) {
        const dob = new Date(row.date_of_birth as string);
        context.age = Math.floor(
          (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        );
      }
      context.gender = row.gender as string;
      context.bloodType = row.blood_type as string;
    }

    // Recent diagnoses from prescriptions (last 12 months)
    const diagResult = await query(
      `SELECT DISTINCT unnest(diagnosis_codes) AS code
       FROM prescriptions
       WHERE patient_id = $1 AND created_at > NOW() - INTERVAL '12 months'
       LIMIT 20`,
      [patientId],
    );
    context.recentDiagnoses = diagResult.rows.map((r) => r.code as string);

    // Active medications
    const medResult = await query(
      `SELECT medications
       FROM prescriptions
       WHERE patient_id = $1
         AND created_at > NOW() - INTERVAL '3 months'
         AND (follow_up_date IS NULL OR follow_up_date > NOW())
       ORDER BY created_at DESC
       LIMIT 5`,
      [patientId],
    );
    for (const row of medResult.rows) {
      const meds = row.medications as Array<{ drugName: string; dosage: string }>;
      if (Array.isArray(meds)) {
        for (const med of meds) {
          context.activeMedications.push(`${med.drugName} ${med.dosage}`);
        }
      }
    }

    // Previous triage events (last 6 months)
    const triageResult = await query(
      `SELECT urgency_level, symptoms, created_at
       FROM triage_events
       WHERE patient_id = $1 AND created_at > NOW() - INTERVAL '6 months'
       ORDER BY created_at DESC
       LIMIT 10`,
      [patientId],
    );
    context.previousTriageEvents = triageResult.rows.map((r) => ({
      urgencyLevel: r.urgency_level as string,
      symptoms: r.symptoms as string[],
      createdAt: (r.created_at as Date).toISOString(),
    }));

    // Recent vitals from biometric telemetry (last 24 hours)
    const vitalsResult = await query(
      `SELECT metric_type, value
       FROM biometric_telemetry
       WHERE patient_id = $1
         AND recorded_at > NOW() - INTERVAL '24 hours'
       ORDER BY recorded_at DESC`,
      [patientId],
    );

    for (const row of vitalsResult.rows) {
      const metric = row.metric_type as string;
      const value = row.value as number;
      if (metric === 'heart_rate' && !context.recentVitals.heartRate) {
        context.recentVitals.heartRate = value;
      } else if (metric === 'spo2' && !context.recentVitals.spO2) {
        context.recentVitals.spO2 = value;
      } else if (metric === 'temperature' && !context.recentVitals.temperature) {
        context.recentVitals.temperature = value;
      }
    }
  } catch (err) {
    logger.warn({ err, patientId }, 'Failed to fully enrich patient context; proceeding with partial data');
  }

  return context;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildTriagePrompt(
  input: TriageInput,
  preprocessed: ReturnType<typeof preprocessSymptoms>,
  context: PatientContext,
): Array<{ role: 'system' | 'user'; content: string }> {
  const systemPrompt = `You are an AI clinical triage assistant for the Aura Health platform, serving Central Asian countries (Uzbekistan, Kyrgyzstan, Tajikistan). Your role is to assess symptom urgency following WHO IMAI (Integrated Management of Adolescent and Adult Illness) guidelines.

CRITICAL RULES:
1. You are a TRIAGE tool, not a diagnostic tool. You help prioritize urgency and suggest next steps.
2. Always err on the side of caution — if uncertain, escalate urgency.
3. Consider the patient's full medical context including age, existing conditions, and medications.
4. Red flags MUST be highlighted prominently: chest pain, difficulty breathing, loss of consciousness, severe bleeding, stroke symptoms (FAST), anaphylaxis signs.
5. Respond in valid JSON matching the exact schema provided.
6. All ICD-11 or SNOMED codes in differential diagnoses must be plausible.
7. Patient guidance must be in the patient's language (${preprocessed.languageDetected}).

URGENCY LEVELS (Manchester Triage System adapted):
- EMERGENCY: Life-threatening, requires immediate medical attention (< 10 min)
- URGENT: Serious, requires attention within 1 hour
- SEMI_URGENT: Needs medical attention within 4-12 hours
- NON_URGENT: Can be managed within 24-72 hours or via teleconsultation

JSON OUTPUT SCHEMA:
{
  "urgencyLevel": "EMERGENCY|URGENT|SEMI_URGENT|NON_URGENT",
  "confidenceScore": 0.0-1.0,
  "recommendedSpecializations": ["specialty1", ...],
  "redFlags": ["flag1", ...],
  "suggestedDiagnostics": ["test1", ...],
  "differentialDiagnoses": [{"code": "ICD-11", "name": "...", "probability": 0.0-1.0}],
  "patientGuidance": "Instructions in patient's language",
  "followUpRecommended": true/false
}`;

  const userContent = `PATIENT CONTEXT:
- Age: ${context.age ?? 'Unknown'}
- Gender: ${context.gender ?? 'Unknown'}
- Blood type: ${context.bloodType ?? 'Unknown'}
- Recent diagnoses (ICD codes): ${context.recentDiagnoses.length > 0 ? context.recentDiagnoses.join(', ') : 'None'}
- Active medications: ${context.activeMedications.length > 0 ? context.activeMedications.join('; ') : 'None'}
- Previous triage events (last 6 months): ${context.previousTriageEvents.length > 0 ? JSON.stringify(context.previousTriageEvents) : 'None'}
- Recent vitals: HR=${context.recentVitals.heartRate ?? 'N/A'}, SpO2=${context.recentVitals.spO2 ?? 'N/A'}%, Temp=${context.recentVitals.temperature ?? 'N/A'}°C

CURRENT PRESENTATION:
- Symptoms: ${preprocessed.normalizedSymptoms.join(', ')}
- Description: ${input.symptomDescription}
- Duration: ${input.duration ?? 'Not specified'}
- Self-reported severity (1-10): ${input.severity ?? 'Not specified'}
- Vital signs provided now: ${input.vitalSigns ? JSON.stringify(input.vitalSigns) : 'None'}

DETECTED LANGUAGE: ${preprocessed.languageDetected}

Provide your triage assessment as a JSON object following the schema above.`;

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userContent },
  ];
}

// ---------------------------------------------------------------------------
// Output validation
// ---------------------------------------------------------------------------

function validateOutput(raw: unknown): TriageOutput & { modelUsed: string } {
  // Parse and validate against Zod schema
  const parsed = triageOutputSchema.parse(raw);

  // Additional clinical validation
  // Confidence below 0.3 should escalate urgency
  if (parsed.confidenceScore < 0.3 && parsed.urgencyLevel === 'NON_URGENT') {
    logger.warn('Low confidence triage marked as NON_URGENT — escalating to SEMI_URGENT');
    parsed.urgencyLevel = 'SEMI_URGENT';
  }

  // If red flags are present, urgency must be at least URGENT
  if (parsed.redFlags.length > 0) {
    const urgencyOrder = ['NON_URGENT', 'SEMI_URGENT', 'URGENT', 'EMERGENCY'];
    const currentIdx = urgencyOrder.indexOf(parsed.urgencyLevel);
    if (currentIdx < 2) {
      logger.warn(
        { redFlags: parsed.redFlags, original: parsed.urgencyLevel },
        'Red flags present but urgency below URGENT — escalating',
      );
      parsed.urgencyLevel = 'URGENT';
    }
  }

  // Ensure at least one differential diagnosis
  if (parsed.differentialDiagnoses.length === 0) {
    parsed.differentialDiagnoses.push({
      code: 'MG30',
      name: 'Symptoms, signs or clinical findings, not elsewhere classified',
      probability: 0.5,
    });
  }

  return {
    ...parsed,
    modelUsed: '', // Will be filled by executeTriage
  };
}

// ---------------------------------------------------------------------------
// Audit logging (blockchain hash)
// ---------------------------------------------------------------------------

async function auditLog(
  input: TriageInput,
  output: TriageOutput,
): Promise<void> {
  try {
    const payload = {
      type: 'TRIAGE_EVENT',
      patientId: input.patientId,
      urgencyLevel: output.urgencyLevel,
      modelUsed: output.modelUsed,
      confidenceScore: output.confidenceScore,
      symptomCount: input.symptoms.length,
      timestamp: new Date().toISOString(),
    };

    const hash = sha256(JSON.stringify(payload));

    await query(
      `INSERT INTO audit_log (id, event_type, entity_id, payload_hash, created_at)
       VALUES (gen_random_uuid(), 'TRIAGE', $1, $2, NOW())`,
      [input.patientId, hash],
    );

    logger.debug({ hash, patientId: input.patientId }, 'Triage audit log recorded');
  } catch (err) {
    // Audit failures should not block the triage result
    logger.error({ err }, 'Failed to write triage audit log');
  }
}

// ---------------------------------------------------------------------------
// Main triage execution
// ---------------------------------------------------------------------------

export async function executeTriage(input: TriageInput): Promise<TriageOutput> {
  logger.info({ patientId: input.patientId, symptomCount: input.symptoms.length }, 'Starting triage pipeline');

  // Step 1: Preprocess symptoms
  const preprocessed = preprocessSymptoms(input);
  logger.debug({ language: preprocessed.languageDetected }, 'Symptoms preprocessed');

  // Step 2: Enrich patient context from DB
  const context = await enrichContext(input.patientId);
  logger.debug(
    {
      age: context.age,
      recentDiagnoses: context.recentDiagnoses.length,
      activeMeds: context.activeMedications.length,
    },
    'Patient context enriched',
  );

  // Step 3: Build prompt
  const messages = buildTriagePrompt(input, preprocessed, context);

  // Step 4: Call AI model with fallback chain
  const result = await callModel('symptom_triage', {
    messages,
    responseFormat: { type: 'json_object' },
  });

  // Step 5: Parse and validate output
  let parsedOutput: ReturnType<typeof validateOutput>;
  try {
    const rawJson = JSON.parse(result.content);
    parsedOutput = validateOutput(rawJson);
    parsedOutput.modelUsed = result.modelUsed;
  } catch (err) {
    logger.error(
      { err, rawContent: result.content.slice(0, 500) },
      'Failed to parse triage model output',
    );
    // Return a safe fallback that escalates to urgent
    return {
      urgencyLevel: 'URGENT',
      confidenceScore: 0.2,
      recommendedSpecializations: ['General Medicine'],
      redFlags: ['AI output parse failure — manual review required'],
      suggestedDiagnostics: ['Complete physical examination'],
      differentialDiagnoses: [
        { code: 'MG30', name: 'Undetermined condition', probability: 0.5 },
      ],
      patientGuidance: 'Please visit your nearest healthcare facility for evaluation.',
      followUpRecommended: true,
      modelUsed: result.modelUsed,
    };
  }

  // Step 6: Audit log (non-blocking)
  auditLog(input, parsedOutput).catch(() => {
    // Already logged inside auditLog
  });

  logger.info(
    {
      urgency: parsedOutput.urgencyLevel,
      confidence: parsedOutput.confidenceScore,
      model: parsedOutput.modelUsed,
      latencyMs: result.latencyMs,
    },
    'Triage completed',
  );

  return parsedOutput;
}
