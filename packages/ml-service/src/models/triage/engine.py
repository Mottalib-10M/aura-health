"""Symptom Triage Engine -- multilingual clinical decision support.

Orchestrates multilingual NLP preprocessing, patient context enrichment,
LLM-based reasoning with WHO emergency guidelines, and output validation
against SNOMED CT codes and confidence thresholds.
"""

from __future__ import annotations

import re
import time
from typing import Any

import asyncpg
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.models.triage.schemas import (
    DifferentialDiagnosis,
    Language,
    RedFlag,
    RecommendedAction,
    Symptom,
    TriageInput,
    TriageOutput,
    TriageSeverity,
)
from src.pipelines.ai_router import AIRouter
from src.utils.phi_scrubber import PHIScrubber
from src.utils.metrics import (
    MODEL_INFERENCE_DURATION,
    TRIAGE_CONFIDENCE,
    TRIAGE_REJECTIONS,
    TRIAGE_SEVERITY_COUNT,
)

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# System prompt embedding WHO emergency triage guidelines
# ---------------------------------------------------------------------------

TRIAGE_SYSTEM_PROMPT = """\
You are a clinical triage assistant for the Uzavita platform, serving healthcare
providers in Central Asia (Uzbekistan, Kyrgyzstan, Tajikistan) and surrounding regions.

## Role & Constraints
- You assist healthcare workers in triaging patients; you do NOT replace clinical judgment.
- You MUST follow WHO Emergency Triage Assessment and Treatment (ETAT+) guidelines.
- All outputs must include SNOMED CT codes where applicable.
- You must account for endemic diseases prevalent in Central Asia.
- You must consider the patient's age, sex, pregnancy status, chronic conditions, and medications.
- When uncertain, escalate to a higher severity level (err on the side of caution).

## Severity Classification (WHO-aligned)
1. **emergency** -- Life-threatening; immediate intervention required (e.g., airway obstruction,
   severe hemorrhage, anaphylaxis, stroke, STEMI).
2. **urgent** -- Serious condition requiring care within 1-2 hours (e.g., open fractures,
   severe abdominal pain, high fever with rigors).
3. **semi_urgent** -- Needs attention within 4-8 hours (e.g., moderate pain, minor trauma,
   localized infection).
4. **non_urgent** -- Can wait >8 hours (e.g., chronic pain exacerbation, minor rash, refill requests).
5. **self_care** -- Does not require facility visit (e.g., mild URI, minor bruise).

## Red Flags (require immediate escalation to emergency/urgent)
- Chest pain with dyspnea or diaphoresis
- Sudden severe headache ("thunderclap")
- Signs of meningism (neck stiffness + fever + photophobia)
- Hemodynamic instability (SBP < 90, HR > 130, SpO2 < 90%)
- Acute neurological deficit (facial droop, limb weakness, speech difficulty)
- Active uncontrolled bleeding
- Severe allergic reaction / anaphylaxis
- Signs of sepsis (qSOFA >= 2)
- Acute abdomen with peritoneal signs
- Eclampsia / severe pre-eclampsia in pregnant patients

## Regional Pathology Awareness
Central Asian endemic considerations: brucellosis (livestock contact), typhoid fever,
tuberculosis (high prevalence), echinococcosis (hydatid cysts), leishmaniasis, Crimean-Congo
hemorrhagic fever, anthrax (agricultural regions), hepatitis A/E, seasonal influenza patterns.

## Output Format
Respond with a JSON object matching the TriageOutput schema. Include:
- severity: one of the five levels
- confidence: 0.0-1.0
- red_flags: list of critical findings
- differential_diagnoses: ranked list with SNOMED codes and probabilities
- recommended_actions: next steps with urgency and timeframe
- reasoning_summary: 2-4 sentence clinical reasoning
"""

# ---------------------------------------------------------------------------
# 12 Few-shot examples covering regional pathologies
# ---------------------------------------------------------------------------

TRIAGE_EXAMPLES: list[dict[str, Any]] = [
    {
        "role": "user",
        "content": (
            "Patient: 45M, farmer from Bukhara region. Symptoms: undulating fever for 3 weeks, "
            "profuse night sweats, joint pain (large joints), fatigue. Vitals: T 38.9C, HR 98, "
            "BP 120/78. History of handling livestock."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"urgent","confidence":0.88,"red_flags":[],'
            '"differential_diagnoses":[{"condition":"Brucellosis","snomed_code":"75702008",'
            '"icd10_code":"A23.9","probability":0.75,"reasoning":"Undulating fever with night sweats '
            'and arthralgia in a livestock farmer from endemic region is classic for brucellosis."},'
            '{"condition":"Typhoid Fever","snomed_code":"4834000","icd10_code":"A01.0",'
            '"probability":0.12,"reasoning":"Prolonged fever could suggest enteric fever, '
            'but joint involvement and sweats favour brucellosis."},'
            '{"condition":"Tuberculosis","snomed_code":"56717001","icd10_code":"A15.9",'
            '"probability":0.08,"reasoning":"Night sweats and prolonged fever warrant TB screening '
            'given high regional prevalence."}],'
            '"recommended_actions":[{"action":"Blood cultures (at least 2 sets) and Brucella serology '
            '(Rose Bengal + SAT)","urgency":"urgent","timeframe_hours":4,'
            '"facility_type":"district_hospital"},'
            '{"action":"Start empiric doxycycline + streptomycin pending results",'
            '"urgency":"urgent","timeframe_hours":4,"facility_type":"district_hospital"}],'
            '"reasoning_summary":"45-year-old male farmer presenting with classic undulating fever '
            'triad (fever, sweats, arthralgia) and livestock contact in an endemic region. '
            'Brucellosis is the primary differential. Urgent workup and empiric treatment indicated."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 28F, pregnant (32 weeks), Tashkent. Symptoms: severe headache, visual "
            "disturbances (seeing spots), epigastric pain, facial/hand edema. Vitals: BP 168/110, "
            "HR 92, T 36.8C. Urine: 3+ protein."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"emergency","confidence":0.95,"red_flags":[{"flag":"severe_preeclampsia",'
            '"description":"BP >= 160/110 with proteinuria, visual changes, and epigastric pain '
            'in third trimester meets criteria for severe preeclampsia with imminent eclampsia risk.",'
            '"references":["WHO Managing Complications in Pregnancy and Childbirth 2017",'
            '"ACOG Practice Bulletin 222"]}],'
            '"differential_diagnoses":[{"condition":"Severe Preeclampsia",'
            '"snomed_code":"46764007","icd10_code":"O14.1","probability":0.92,'
            '"reasoning":"Classic presentation: severe hypertension, proteinuria 3+, headache, '
            'visual symptoms, and epigastric pain at 32 weeks."},'
            '{"condition":"HELLP Syndrome","snomed_code":"95605009","icd10_code":"O14.2",'
            '"probability":0.06,"reasoning":"Epigastric pain may indicate hepatic involvement; '
            'requires urgent labs."}],'
            '"recommended_actions":[{"action":"Immediate IV magnesium sulfate loading dose (4g over '
            '15-20 min)","urgency":"emergency","timeframe_hours":0.25,'
            '"facility_type":"emergency_department"},'
            '{"action":"IV labetalol or nifedipine for acute BP control, target < 150/100",'
            '"urgency":"emergency","timeframe_hours":0.5,"facility_type":"emergency_department"},'
            '{"action":"STAT labs: CBC, LFTs, LDH, uric acid, coagulation, creatinine",'
            '"urgency":"emergency","timeframe_hours":0.5,"facility_type":"emergency_department"},'
            '{"action":"Obstetric consultation for delivery planning",'
            '"urgency":"emergency","timeframe_hours":1,"facility_type":"tertiary_hospital"}],'
            '"reasoning_summary":"32-week pregnant female with severe preeclampsia features '
            'including BP 168/110, visual disturbances, epigastric pain, and 3+ proteinuria. '
            'Immediate MgSO4 and antihypertensive therapy required. HELLP must be excluded."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 6-year-old boy, Fergana Valley. Symptoms: persistent cough > 3 weeks, "
            "low-grade fever, weight loss, night sweats, loss of appetite. Known contact with "
            "TB-positive grandfather. BCG scar present."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"urgent","confidence":0.90,"red_flags":[],'
            '"differential_diagnoses":[{"condition":"Pulmonary Tuberculosis",'
            '"snomed_code":"154283005","icd10_code":"A15.0","probability":0.82,'
            '"reasoning":"Chronic cough > 3 weeks with constitutional symptoms and known TB contact '
            'in a high-prevalence region strongly suggests pulmonary TB."},'
            '{"condition":"Bacterial Pneumonia","snomed_code":"233604007","icd10_code":"J18.9",'
            '"probability":0.10,"reasoning":"Persistent cough and fever could indicate bacterial '
            'pneumonia, but duration and contact history favour TB."}],'
            '"recommended_actions":[{"action":"Chest X-ray (PA and lateral)",'
            '"urgency":"urgent","timeframe_hours":24,"facility_type":"district_hospital"},'
            '{"action":"Sputum collection (gastric aspirate if unable to produce sputum) for '
            'GeneXpert MTB/RIF","urgency":"urgent","timeframe_hours":24,'
            '"facility_type":"district_hospital"},'
            '{"action":"TST or IGRA testing","urgency":"urgent","timeframe_hours":48,'
            '"facility_type":"primary_care"},'
            '{"action":"Nutritional support and isolation precautions pending results",'
            '"urgency":"urgent","timeframe_hours":24,"facility_type":"primary_care"}],'
            '"reasoning_summary":"6-year-old with classic TB presentation (chronic cough, '
            'constitutional symptoms, known household contact) in a high-prevalence region. '
            'Urgent diagnostic workup with GeneXpert is the priority."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 55M, Samarkand. Symptoms: sudden crushing chest pain radiating to left arm "
            "and jaw for 30 minutes, diaphoresis, nausea. Vitals: BP 90/60, HR 110, SpO2 93%, "
            "T 36.5C. History: diabetes, smoker."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"emergency","confidence":0.97,"red_flags":[{"flag":"stemi_presentation",'
            '"description":"Crushing chest pain with radiation, diaphoresis, hypotension, and '
            'tachycardia -- classic STEMI presentation requiring immediate intervention.",'
            '"references":["WHO Package of Essential NCD Interventions","ESC STEMI Guidelines 2023"]},'
            '{"flag":"hemodynamic_instability","description":"SBP 90/60 with HR 110 indicates '
            'possible cardiogenic shock.","references":["AHA ACLS Guidelines"]}],'
            '"differential_diagnoses":[{"condition":"ST-Elevation Myocardial Infarction",'
            '"snomed_code":"401303003","icd10_code":"I21.0","probability":0.90,'
            '"reasoning":"Classic presentation with risk factors (DM, smoking). Hemodynamic '
            'instability suggests large territory infarct."},'
            '{"condition":"Aortic Dissection","snomed_code":"308546005","icd10_code":"I71.0",'
            '"probability":0.05,"reasoning":"Tearing quality not described but must be considered '
            'in differential for acute chest pain with hypotension."}],'
            '"recommended_actions":[{"action":"12-lead ECG STAT","urgency":"emergency",'
            '"timeframe_hours":0.1,"facility_type":"emergency_department"},'
            '{"action":"Aspirin 325mg + dual antiplatelet, IV access, cardiac monitoring",'
            '"urgency":"emergency","timeframe_hours":0.1,"facility_type":"emergency_department"},'
            '{"action":"Activate cath lab or arrange fibrinolysis if PCI unavailable",'
            '"urgency":"emergency","timeframe_hours":0.5,"facility_type":"tertiary_hospital"}],'
            '"reasoning_summary":"55-year-old diabetic smoker with classic STEMI presentation and '
            'hemodynamic compromise. Door-to-balloon time critical. Immediate ECG and STEMI '
            'activation protocol required."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 35F, rural Kyrgyzstan. Symptoms: right upper quadrant pain for 2 months, "
            "palpable hepatic mass, mild jaundice. History: sheep farming, dog contact. "
            "Vitals stable."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"semi_urgent","confidence":0.85,"red_flags":[],'
            '"differential_diagnoses":[{"condition":"Hepatic Echinococcosis (Hydatid Cyst)",'
            '"snomed_code":"32218004","icd10_code":"B67.0","probability":0.72,'
            '"reasoning":"Slowly progressive hepatic mass in a sheep farmer with dog contact in '
            'Central Asia is highly suggestive of Echinococcus granulosus."},'
            '{"condition":"Hepatocellular Carcinoma","snomed_code":"109841003",'
            '"icd10_code":"C22.0","probability":0.10,"reasoning":"Hepatic mass with jaundice '
            'warrants malignancy screening, though age and epidemiology favour echinococcosis."},'
            '{"condition":"Hepatic Abscess","snomed_code":"4981000","icd10_code":"K75.0",'
            '"probability":0.08,"reasoning":"Pyogenic or amoebic abscess possible but typically '
            'presents more acutely."}],'
            '"recommended_actions":[{"action":"Abdominal ultrasound with hepatic focus",'
            '"urgency":"semi_urgent","timeframe_hours":48,"facility_type":"district_hospital"},'
            '{"action":"Echinococcus serology (IgG ELISA)","urgency":"semi_urgent",'
            '"timeframe_hours":72,"facility_type":"district_hospital"},'
            '{"action":"CT abdomen if ultrasound confirms cystic lesion",'
            '"urgency":"non_urgent","timeframe_hours":168,"facility_type":"tertiary_hospital"},'
            '{"action":"DO NOT attempt percutaneous aspiration until echinococcosis excluded '
            '(anaphylaxis risk)","urgency":"urgent","timeframe_hours":0,'
            '"facility_type":"district_hospital"}],'
            '"reasoning_summary":"35-year-old sheep farmer from Kyrgyzstan with chronic hepatic '
            'mass and jaundice. Hepatic echinococcosis is the leading differential. Imaging and '
            'serology needed; aspiration contraindicated until diagnosis confirmed."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 22M, Dushanbe, Tajikistan. Symptoms: high fever 40.1C for 5 days, "
            "relative bradycardia, rose spots on abdomen, constipation followed by diarrhea, "
            "hepatosplenomegaly. Recent travel to rural area with poor sanitation."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"urgent","confidence":0.91,"red_flags":[],'
            '"differential_diagnoses":[{"condition":"Typhoid Fever","snomed_code":"4834000",'
            '"icd10_code":"A01.0","probability":0.85,"reasoning":"Stepladder fever, relative '
            'bradycardia, rose spots, and hepatosplenomegaly form the classic typhoid triad. '
            'Travel to rural area with poor sanitation is a key risk factor."},'
            '{"condition":"Brucellosis","snomed_code":"75702008","icd10_code":"A23.9",'
            '"probability":0.07,"reasoning":"Prolonged fever and hepatosplenomegaly overlap, '
            'but rose spots and fever pattern favour typhoid."}],'
            '"recommended_actions":[{"action":"Blood cultures x2 (before antibiotics)",'
            '"urgency":"urgent","timeframe_hours":2,"facility_type":"district_hospital"},'
            '{"action":"Start empiric ceftriaxone or azithromycin pending culture",'
            '"urgency":"urgent","timeframe_hours":4,"facility_type":"district_hospital"},'
            '{"action":"Widal test (if cultures unavailable) and CBC, LFTs",'
            '"urgency":"urgent","timeframe_hours":4,"facility_type":"district_hospital"}],'
            '"reasoning_summary":"22-year-old male from Tajikistan with classic typhoid fever '
            'presentation including stepladder fever, relative bradycardia, and rose spots. '
            'Blood cultures and empiric treatment are urgent priorities."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 18F, Tashkent. Symptoms: sore throat for 2 days, mild cough, runny nose, "
            "slight fatigue. No fever. Vitals normal. No chronic conditions."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"self_care","confidence":0.92,"red_flags":[],'
            '"differential_diagnoses":[{"condition":"Acute Viral Upper Respiratory Infection",'
            '"snomed_code":"54150009","icd10_code":"J06.9","probability":0.88,'
            '"reasoning":"Mild URI symptoms without fever or systemic signs in a young, '
            'healthy patient."},'
            '{"condition":"Allergic Rhinitis","snomed_code":"61582004","icd10_code":"J30.9",'
            '"probability":0.08,"reasoning":"Rhinorrhea and mild cough could reflect allergic '
            'etiology, especially if seasonal."}],'
            '"recommended_actions":[{"action":"Symptomatic care: warm fluids, rest, honey for '
            'cough, saline nasal rinse","urgency":"self_care","timeframe_hours":null,'
            '"facility_type":null},'
            '{"action":"Return if fever > 38.5C, worsening symptoms, or duration > 10 days",'
            '"urgency":"non_urgent","timeframe_hours":240,"facility_type":"primary_care"}],'
            '"reasoning_summary":"Healthy 18-year-old with mild upper respiratory symptoms and '
            'no red flags. Self-care with return precautions is appropriate."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 40M, agricultural worker, Karakalpakstan. Symptoms: painless black eschar "
            "on right forearm, surrounding edema, mild fever. Appeared 3 days after handling "
            "dead sheep. No respiratory symptoms."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"urgent","confidence":0.89,"red_flags":[],'
            '"differential_diagnoses":[{"condition":"Cutaneous Anthrax","snomed_code":"409498004",'
            '"icd10_code":"A22.0","probability":0.82,"reasoning":"Classic painless black eschar '
            'with edema following contact with dead animal in an endemic agricultural region."},'
            '{"condition":"Ecthyma Gangrenosum","snomed_code":"238413005",'
            '"icd10_code":"L08.0","probability":0.08,"reasoning":"Necrotic skin lesion can '
            'mimic anthrax but lacks the epidemiologic link."}],'
            '"recommended_actions":[{"action":"Vesicle fluid/eschar swab for Gram stain and '
            'culture (B. anthracis)","urgency":"urgent","timeframe_hours":4,'
            '"facility_type":"district_hospital"},'
            '{"action":"Start oral ciprofloxacin 500mg BID empirically",'
            '"urgency":"urgent","timeframe_hours":2,"facility_type":"district_hospital"},'
            '{"action":"Notify regional public health authority (reportable disease)",'
            '"urgency":"urgent","timeframe_hours":4,"facility_type":"district_hospital"},'
            '{"action":"Investigate dead animal source and potential community exposure",'
            '"urgency":"urgent","timeframe_hours":24,"facility_type":"public_health"}],'
            '"reasoning_summary":"Agricultural worker with classic cutaneous anthrax presentation '
            '(painless eschar after dead animal contact) in an endemic region. Requires urgent '
            'treatment, culture confirmation, and public health notification."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 60F, Namangan. Symptoms: productive cough with hemoptysis for 1 week, "
            "weight loss 8kg over 2 months, night sweats, anorexia. History: diabetes, no prior "
            "TB treatment. Contact with TB patient in neighborhood."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"urgent","confidence":0.93,"red_flags":[{"flag":"hemoptysis",'
            '"description":"Active hemoptysis requires assessment for massive hemoptysis risk '
            'and airway compromise.","references":["WHO TB Guidelines 2022"]}],'
            '"differential_diagnoses":[{"condition":"Pulmonary Tuberculosis",'
            '"snomed_code":"154283005","icd10_code":"A15.0","probability":0.85,'
            '"reasoning":"Classic TB presentation: chronic productive cough with hemoptysis, '
            'weight loss, night sweats, known contact, and diabetes as risk factor for '
            'reactivation in a high-burden country."},'
            '{"condition":"Lung Carcinoma","snomed_code":"254637007","icd10_code":"C34.9",'
            '"probability":0.08,"reasoning":"Age and constitutional symptoms warrant malignancy '
            'screening, though TB is far more likely in this context."}],'
            '"recommended_actions":[{"action":"Sputum for GeneXpert MTB/RIF (same-day result) '
            'x2 specimens","urgency":"urgent","timeframe_hours":12,'
            '"facility_type":"district_hospital"},'
            '{"action":"Chest X-ray PA","urgency":"urgent","timeframe_hours":24,'
            '"facility_type":"district_hospital"},'
            '{"action":"Airborne isolation precautions pending results",'
            '"urgency":"urgent","timeframe_hours":0,"facility_type":"district_hospital"},'
            '{"action":"Screen household contacts","urgency":"semi_urgent",'
            '"timeframe_hours":168,"facility_type":"primary_care"}],'
            '"reasoning_summary":"60-year-old diabetic woman with classic pulmonary TB '
            'presentation and hemoptysis in a high-prevalence setting. Urgent GeneXpert '
            'testing and isolation required. Hemoptysis adds urgency for airway assessment."}'
        ),
    },
    {
        "role": "user",
        "content": (
            "Patient: 8M, Osh, Kyrgyzstan. Symptoms: severe abdominal pain (periumbilical -> "
            "RLQ migration), nausea, vomiting, low-grade fever 37.8C. Onset 12 hours ago. "
            "Vitals: HR 105, rebound tenderness positive."
        ),
    },
    {
        "role": "assistant",
        "content": (
            '{"severity":"urgent","confidence":0.91,"red_flags":[{"flag":"peritoneal_signs",'
            '"description":"Rebound tenderness indicates peritoneal irritation with risk of '
            'perforation.","references":["WHO Emergency and Essential Surgical Care"]}],'
            '"differential_diagnoses":[{"condition":"Acute Appendicitis",'
            '"snomed_code":"74400008","icd10_code":"K35.9","probability":0.85,'
            '"reasoning":"Classic migratory pain (periumbilical to RLQ), anorexia, low-grade '
            'fever, and peritoneal signs in a child -- Alvarado score >= 7."},'
            '{"condition":"Mesenteric Lymphadenitis","snomed_code":"65658006",'
            '"icd10_code":"I88.0","probability":0.08,"reasoning":"Can mimic appendicitis '
            'in children, often post-viral."}],'
            '"recommended_actions":[{"action":"Surgical consultation for possible appendectomy",'
            '"urgency":"urgent","timeframe_hours":2,"facility_type":"district_hospital"},'
            '{"action":"CBC, CRP, urinalysis","urgency":"urgent","timeframe_hours":1,'
            '"facility_type":"district_hospital"},'
            '{"action":"Abdominal ultrasound (preferred imaging in pediatrics)",'
            '"urgency":"urgent","timeframe_hours":2,"facility_type":"district_hospital"},'
            '{"action":"NPO, IV fluids, pain management","urgency":"urgent",'
            '"timeframe_hours":0.5,"facility_type":"district_hospital"}],'
            '"reasoning_summary":"8-year-old boy with classic appendicitis presentation '
            'including migratory pain and peritoneal signs. Surgical consultation and imaging '
            'are urgent to prevent perforation."}'
        ),
    },
]

# ---------------------------------------------------------------------------
# SNOMED CT code validation set (subset relevant to Central Asian pathologies)
# ---------------------------------------------------------------------------
_VALID_SNOMED_CODES: set[str] = {
    "75702008", "4834000", "56717001", "32218004", "109841003",
    "4981000", "54150009", "61582004", "409498004", "238413005",
    "154283005", "254637007", "74400008", "65658006", "46764007",
    "95605009", "401303003", "308546005", "233604007", "49727002",
    "38341003", "13645005", "840539006", "186747009", "36989005",
    "399211009", "25374005", "195967001", "22298006", "73211009",
}


class TriageEngine:
    """Multilingual symptom triage engine with LLM-based clinical reasoning.

    The engine follows a pipeline architecture:
    1. Preprocess symptoms (normalize multilingual input, NER extraction)
    2. Enrich context (fetch patient history from PostgreSQL)
    3. Build prompt (system prompt + few-shot examples + patient data)
    4. Execute LLM inference with model routing based on severity signals
    5. Validate output (SNOMED CT codes, confidence thresholds)
    """

    def __init__(self, ai_router: AIRouter, db_pool: asyncpg.Pool | None = None) -> None:
        self._router = ai_router
        self._db_pool = db_pool
        self._settings = get_settings()
        self._log = logger.bind(component="triage_engine")

    # ------------------------------------------------------------------
    # 1. Preprocessing
    # ------------------------------------------------------------------

    def preprocess_symptoms(self, text: str, language: Language) -> str:
        """Normalize multilingual symptom text and extract named entities.

        Handles Uzbek (Latin & Cyrillic), Kyrgyz, Tajik, Russian, and English.
        Performs basic NER for body parts, durations, and severity descriptors.

        Args:
            text: Raw symptom description from the patient/provider.
            language: ISO language code.

        Returns:
            Normalised, annotated symptom string for prompt construction.
        """
        # Normalise whitespace and control characters
        text = re.sub(r"\s+", " ", text.strip())

        # Basic transliteration hints for Uzbek Latin <-> Cyrillic
        if language == Language.UZ:
            transliterations = {
                "\u045e": "o'",  # ў -> o'
                "\u049b": "q",   # қ -> q
                "\u0493": "g'",  # ғ -> g'
                "\u04b3": "h",   # ҳ -> h
            }
            for cyr, lat in transliterations.items():
                text = text.replace(cyr, lat)

        # Duration extraction (e.g., "3 kun", "2 hafta", "5 дней")
        duration_patterns = {
            Language.UZ: r"(\d+)\s*(kun|hafta|oy|soat)",
            Language.RU: r"(\d+)\s*(дн[яей]*|недел[ьяи]*|месяц\w*|час\w*)",
            Language.KG: r"(\d+)\s*(күн|жума|ай|саат)",
            Language.TJ: r"(\d+)\s*(рӯз|ҳафта|моҳ|соат)",
            Language.EN: r"(\d+)\s*(day|week|month|hour)s?",
        }

        pattern = duration_patterns.get(language, duration_patterns[Language.EN])
        durations = re.findall(pattern, text, re.IGNORECASE)

        # Annotate extracted durations
        annotations: list[str] = []
        for amount, unit in durations:
            annotations.append(f"[DURATION: {amount} {unit}]")

        # Severity keywords extraction
        severity_keywords = {
            Language.EN: {"severe", "mild", "moderate", "intense", "unbearable", "sharp", "dull"},
            Language.RU: {"сильный", "слабый", "умеренный", "острый", "тупой", "невыносимый"},
            Language.UZ: {"kuchli", "yengil", "o'rtacha", "o'tkir", "chidab bo'lmas"},
            Language.KG: {"күчтүү", "жеңил", "орточо", "курч"},
            Language.TJ: {"сахт", "сабук", "миёна", "тез"},
        }

        keywords = severity_keywords.get(language, severity_keywords[Language.EN])
        found_severity = [w for w in text.lower().split() if w in keywords]
        if found_severity:
            annotations.append(f"[SEVERITY_TERMS: {', '.join(found_severity)}]")

        if annotations:
            return f"{text} | NER: {' '.join(annotations)}"
        return text

    # ------------------------------------------------------------------
    # 2. Context Enrichment
    # ------------------------------------------------------------------

    async def enrich_context(self, patient_id: str) -> dict[str, Any]:
        """Fetch patient history from PostgreSQL for context-aware triage.

        Args:
            patient_id: Unique patient identifier.

        Returns:
            Dictionary containing patient history, prior triages, chronic
            conditions, and recent lab results.
        """
        context: dict[str, Any] = {
            "prior_triages": [],
            "chronic_conditions": [],
            "recent_labs": [],
            "recent_visits": [],
            "active_medications": [],
        }

        if self._db_pool is None:
            self._log.warning("no_db_pool", patient_id=patient_id)
            return context

        try:
            async with self._db_pool.acquire() as conn:
                # Fetch recent triage history
                rows = await conn.fetch(
                    """
                    SELECT severity, confidence, primary_diagnosis, created_at
                    FROM triage_results
                    WHERE patient_id = $1
                    ORDER BY created_at DESC
                    LIMIT 5
                    """,
                    patient_id,
                )
                context["prior_triages"] = [dict(r) for r in rows]

                # Fetch chronic conditions
                rows = await conn.fetch(
                    """
                    SELECT condition_name, snomed_code, diagnosed_date, status
                    FROM patient_conditions
                    WHERE patient_id = $1 AND status = 'active'
                    """,
                    patient_id,
                )
                context["chronic_conditions"] = [dict(r) for r in rows]

                # Fetch recent lab results
                rows = await conn.fetch(
                    """
                    SELECT test_name, value, unit, reference_range, collected_at
                    FROM lab_results
                    WHERE patient_id = $1
                    ORDER BY collected_at DESC
                    LIMIT 10
                    """,
                    patient_id,
                )
                context["recent_labs"] = [dict(r) for r in rows]

                # Fetch active medications
                rows = await conn.fetch(
                    """
                    SELECT medication_name, dosage, frequency, start_date
                    FROM patient_medications
                    WHERE patient_id = $1 AND status = 'active'
                    """,
                    patient_id,
                )
                context["active_medications"] = [dict(r) for r in rows]

        except Exception:
            self._log.exception("context_enrichment_failed", patient_id=patient_id)

        return context

    # ------------------------------------------------------------------
    # 3. Prompt Construction
    # ------------------------------------------------------------------

    def build_prompt(self, input_data: TriageInput, context: dict[str, Any]) -> list[dict[str, str]]:
        """Assemble the full prompt with system instructions, few-shot examples,
        and the current patient case.

        Args:
            input_data: Validated triage input.
            context: Enrichment context from ``enrich_context``.

        Returns:
            List of message dicts suitable for LLM chat completion.
        """
        messages: list[dict[str, str]] = [
            {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
        ]

        # Add few-shot examples
        messages.extend(TRIAGE_EXAMPLES)

        # Build the patient case
        symptom_descriptions = []
        for s in input_data.symptoms:
            processed = self.preprocess_symptoms(s.description, input_data.language)
            parts = [processed]
            if s.onset_hours_ago is not None:
                parts.append(f"(onset {s.onset_hours_ago}h ago)")
            if s.severity_self_reported is not None:
                parts.append(f"(self-reported severity {s.severity_self_reported}/10)")
            if s.body_region:
                parts.append(f"(region: {s.body_region})")
            symptom_descriptions.append(" ".join(parts))

        case_parts = [
            f"Patient: {input_data.age_years or 'unknown age'}"
            f"{input_data.sex[0].upper() if input_data.sex else '?'}"
            f", {input_data.region or 'unspecified region'}.",
            f"Symptoms: {'; '.join(symptom_descriptions)}.",
        ]

        if input_data.vital_signs:
            vs = input_data.vital_signs
            vitals_str = ", ".join(
                f"{k}: {v}"
                for k, v in vs.model_dump(exclude_none=True).items()
            )
            case_parts.append(f"Vitals: {vitals_str}.")

        if input_data.pregnant:
            case_parts.append("Patient is pregnant.")

        if input_data.chronic_conditions:
            case_parts.append(f"Chronic conditions: {', '.join(input_data.chronic_conditions)}.")

        if input_data.current_medications:
            case_parts.append(f"Current medications: {', '.join(input_data.current_medications)}.")

        if input_data.allergies:
            case_parts.append(f"Allergies: {', '.join(input_data.allergies)}.")

        # Include context from DB
        if context.get("prior_triages"):
            prior = context["prior_triages"][:3]
            prior_str = "; ".join(
                f"{p.get('primary_diagnosis', 'N/A')} ({p.get('severity', 'N/A')}, {p.get('created_at', 'N/A')})"
                for p in prior
            )
            case_parts.append(f"Recent triage history: {prior_str}.")

        if context.get("recent_labs"):
            labs = context["recent_labs"][:5]
            labs_str = "; ".join(
                f"{l.get('test_name', 'N/A')}: {l.get('value', 'N/A')} {l.get('unit', '')} "
                f"(ref: {l.get('reference_range', 'N/A')})"
                for l in labs
            )
            case_parts.append(f"Recent labs: {labs_str}.")

        messages.append({"role": "user", "content": " ".join(case_parts)})

        return messages

    # ------------------------------------------------------------------
    # 4. Model Selection
    # ------------------------------------------------------------------

    def _select_model(self, severity_hint: str | None, has_red_flags: bool) -> str:
        """Route to the appropriate model based on severity signals.

        Routing policy:
        - Default: DeepSeek V3.2 (cost-effective, good multilingual)
        - Fallback: GPT-4.1-nano (fast, reliable baseline)
        - Critical (red flags or suspected emergency): Claude Sonnet 4.5 (highest accuracy)

        Args:
            severity_hint: Optional preliminary severity from vital signs analysis.
            has_red_flags: Whether preliminary analysis detected red flags.

        Returns:
            Model identifier string for LiteLLM.
        """
        if has_red_flags or severity_hint == "emergency":
            return "anthropic/claude-sonnet-4-5-20241022"
        if severity_hint == "urgent":
            return "deepseek/deepseek-chat"
        return "deepseek/deepseek-chat"

    def _detect_preliminary_red_flags(self, input_data: TriageInput) -> tuple[bool, str | None]:
        """Perform rule-based preliminary red flag detection from vitals.

        Returns:
            Tuple of (has_red_flags, severity_hint).
        """
        vs = input_data.vital_signs
        if vs is None:
            return False, None

        red_flags = False
        severity = None

        # Hemodynamic instability
        if vs.blood_pressure_systolic is not None and vs.blood_pressure_systolic < 90:
            red_flags = True
            severity = "emergency"
        if vs.heart_rate_bpm is not None and vs.heart_rate_bpm > 130:
            red_flags = True
            severity = "emergency"
        if vs.spo2_percent is not None and vs.spo2_percent < 90:
            red_flags = True
            severity = "emergency"
        if vs.temperature_celsius is not None and vs.temperature_celsius > 40.5:
            red_flags = True
            severity = severity or "urgent"
        if vs.respiratory_rate is not None and vs.respiratory_rate > 30:
            red_flags = True
            severity = severity or "urgent"

        # Severe hypertension (especially if pregnant)
        if vs.blood_pressure_systolic is not None and vs.blood_pressure_systolic >= 160:
            if input_data.pregnant:
                red_flags = True
                severity = "emergency"
            else:
                severity = severity or "urgent"

        return red_flags, severity

    # ------------------------------------------------------------------
    # 5. Execution Pipeline
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def execute(self, input_data: TriageInput) -> TriageOutput:
        """Execute the full triage pipeline.

        Pipeline steps:
        1. Preliminary red flag detection from vitals
        2. Context enrichment from patient history
        3. Prompt construction with few-shot examples
        4. LLM inference with model routing
        5. Output parsing and validation

        Args:
            input_data: Validated ``TriageInput``.

        Returns:
            Validated ``TriageOutput``.

        Raises:
            ValueError: If output validation fails after retries.
        """
        start_time = time.monotonic()
        self._log.info(
            "triage_started",
            patient_id=input_data.patient_id,
            symptom_count=len(input_data.symptoms),
            language=input_data.language,
        )

        # Step 1: Preliminary red flag detection
        has_red_flags, severity_hint = self._detect_preliminary_red_flags(input_data)

        # Step 2: Model selection
        model = self._select_model(severity_hint, has_red_flags)
        self._log.info("model_selected", model=model, severity_hint=severity_hint, has_red_flags=has_red_flags)

        # Step 3: Context enrichment
        context = await self.enrich_context(input_data.patient_id)

        # Step 4: Build prompt with PHI scrubbing
        phi_scrubber = PHIScrubber()
        scrubbed_patient_id = phi_scrubber.scrub_patient_id(input_data.patient_id)
        messages = self.build_prompt(input_data, context)
        # Scrub PHI from all message content before sending to LLM
        for msg in messages:
            if msg.get("role") == "user":
                msg["content"] = phi_scrubber.scrub_text(msg["content"])

        # Step 5: LLM inference
        try:
            response = await self._router.call_model(
                model=model,
                prompt=messages,
                response_schema=TriageOutput.model_json_schema(),
                temperature=0.1,
            )
        except Exception:
            self._log.warning("primary_model_failed", model=model)
            # Fallback to GPT-4.1-nano
            fallback_model = "openai/gpt-4.1-nano"
            response = await self._router.call_model(
                model=fallback_model,
                prompt=messages,
                response_schema=TriageOutput.model_json_schema(),
                temperature=0.1,
            )
            model = fallback_model

        elapsed_ms = (time.monotonic() - start_time) * 1000

        # Step 6: Parse and construct output
        output = TriageOutput(
            request_id=input_data.request_id,
            patient_id=input_data.patient_id,
            severity=response.get("severity", "non_urgent"),
            confidence=response.get("confidence", 0.0),
            red_flags=[RedFlag(**rf) for rf in response.get("red_flags", [])],
            differential_diagnoses=[
                DifferentialDiagnosis(**dd)
                for dd in response.get("differential_diagnoses", [])
            ],
            recommended_actions=[
                RecommendedAction(**ra)
                for ra in response.get("recommended_actions", [])
            ],
            reasoning_summary=response.get("reasoning_summary", ""),
            model_used=model,
            processing_time_ms=elapsed_ms,
        )

        # Step 7: Validate output
        self.validate_output(output)

        # Record metrics
        MODEL_INFERENCE_DURATION.labels(model_name=model, task_type="triage").observe(elapsed_ms / 1000)
        TRIAGE_CONFIDENCE.labels(severity=output.severity, model_name=model).observe(output.confidence)
        TRIAGE_SEVERITY_COUNT.labels(severity=output.severity).inc()

        self._log.info(
            "triage_completed",
            patient_id=input_data.patient_id,
            severity=output.severity,
            confidence=output.confidence,
            model=model,
            elapsed_ms=elapsed_ms,
        )

        return output

    # ------------------------------------------------------------------
    # 6. Output Validation
    # ------------------------------------------------------------------

    def validate_output(self, output: TriageOutput) -> None:
        """Validate triage output against quality and clinical safety criteria.

        Checks:
        - Confidence threshold (reject < 0.65)
        - SNOMED CT code validity
        - Emergency severity requires red flags

        Args:
            output: The triage output to validate.

        Raises:
            ValueError: If critical validation fails.
        """
        # Confidence threshold
        if output.confidence < self._settings.TRIAGE_CONFIDENCE_THRESHOLD:
            TRIAGE_REJECTIONS.labels(reason="low_confidence").inc()
            self._log.warning(
                "triage_low_confidence",
                patient_id=output.patient_id,
                confidence=output.confidence,
                threshold=self._settings.TRIAGE_CONFIDENCE_THRESHOLD,
            )
            raise ValueError(
                f"Triage confidence {output.confidence:.2f} is below threshold "
                f"{self._settings.TRIAGE_CONFIDENCE_THRESHOLD:.2f}. Manual review required."
            )

        # SNOMED CT validation
        for dd in output.differential_diagnoses:
            if dd.snomed_code and dd.snomed_code not in _VALID_SNOMED_CODES:
                self._log.warning(
                    "invalid_snomed_code",
                    snomed_code=dd.snomed_code,
                    condition=dd.condition,
                )
                # Do not reject but flag -- the LLM may produce valid codes
                # outside our subset; this is a warning, not a hard block.

        # Emergency must have red flags (enforced by Pydantic, but double-check)
        if output.severity == TriageSeverity.EMERGENCY and not output.red_flags:
            TRIAGE_REJECTIONS.labels(reason="emergency_no_red_flags").inc()
            raise ValueError(
                "Emergency-severity triage must include at least one red flag."
            )

        # Diagnoses probability sanity check
        total_prob = sum(dd.probability for dd in output.differential_diagnoses)
        if output.differential_diagnoses and total_prob > 1.5:
            self._log.warning(
                "diagnosis_probability_exceeds_bounds",
                total_probability=total_prob,
            )
