import { useState } from 'react';
import { Pill, Stethoscope, ChevronDown, ChevronUp, Activity, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { useMedicalRecords } from '@/hooks/useMedicalRecords';

// ---------------------------------------------------------------------------
// Section: Prescriptions / Medications
// ---------------------------------------------------------------------------

function MedicationsSection({ prescriptions }: { prescriptions: NonNullable<ReturnType<typeof useMedicalRecords>['patient']>['prescriptions'] }) {
  const [expanded, setExpanded] = useState(true);

  // Extract all active medications from prescriptions
  const medications = prescriptions.flatMap((p) =>
    p.medications.map((m) => ({
      ...m,
      prescribedBy: `Dr. ${p.doctor.firstName} ${p.doctor.lastName}`,
      specialty: p.doctor.specialty,
      diagnosisCodes: p.diagnosisCodes,
      createdAt: p.createdAt,
    })),
  );

  return (
    <Card>
      <CardHeader>
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-500" />
            Current Medications
            <Badge variant="default" size="sm">{medications.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          {medications.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No medications on record.</p>
          ) : (
            <div className="space-y-3">
              {medications.map((med, i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {med.drugName} - {med.dosage}
                    </p>
                    <Badge variant="info" size="sm">{med.frequency}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Prescribed by {med.prescribedBy} ({med.specialty}) | {med.route} | {med.durationDays} days
                  </p>
                  {med.instructions && (
                    <p className="mt-0.5 text-xs text-slate-400 italic">{med.instructions}</p>
                  )}
                  {med.diagnosisCodes.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {med.diagnosisCodes.map((c) => (
                        <Badge key={c} variant="default" size="sm">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: Conditions (from diagnosis codes)
// ---------------------------------------------------------------------------

function ConditionsSection({ prescriptions }: { prescriptions: NonNullable<ReturnType<typeof useMedicalRecords>['patient']>['prescriptions'] }) {
  const [expanded, setExpanded] = useState(true);

  // Extract unique diagnosis codes with efficacy info
  const conditionsMap = new Map<string, { code: string; efficacyScore: number | null; outcomeAssessment: string | null; date: string }>();
  for (const p of prescriptions) {
    for (const code of p.diagnosisCodes) {
      if (!conditionsMap.has(code) || new Date(p.createdAt) > new Date(conditionsMap.get(code)!.date)) {
        conditionsMap.set(code, {
          code,
          efficacyScore: p.efficacyScore,
          outcomeAssessment: p.outcomeAssessment,
          date: p.createdAt,
        });
      }
    }
  }
  const conditions = Array.from(conditionsMap.values());

  return (
    <Card>
      <CardHeader>
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary-500" />
            Diagnoses
            <Badge variant="default" size="sm">{conditions.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          {conditions.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No diagnoses on record.</p>
          ) : (
            <div className="space-y-3">
              {conditions.map((c) => (
                <div key={c.code} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">ICD: {c.code}</p>
                    {c.outcomeAssessment && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.outcomeAssessment}</p>
                    )}
                  </div>
                  {c.efficacyScore !== null && (
                    <Badge variant={c.efficacyScore >= 0.8 ? 'success' : c.efficacyScore >= 0.6 ? 'warning' : 'error'} size="sm">
                      Efficacy: {Math.round(c.efficacyScore * 100)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: Triage History
// ---------------------------------------------------------------------------

function TriageSection({ triageHistory }: { triageHistory: NonNullable<ReturnType<typeof useMedicalRecords>['patient']>['triageHistory'] }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" />
            Triage History
            <Badge variant="default" size="sm">{triageHistory.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          {triageHistory.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No triage events on record.</p>
          ) : (
            <div className="space-y-3">
              {triageHistory.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {t.urgencyLevel} - Confidence {Math.round(t.confidenceScore * 100)}%
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.symptomDescription}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.symptoms.map((s) => (
                      <Badge key={s} variant="default" size="sm">{s}</Badge>
                    ))}
                  </div>
                  {t.recommendedSpecializations.length > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      Recommended: {t.recommendedSpecializations.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: Vitals Summary
// ---------------------------------------------------------------------------

function VitalsSummarySection({ summary }: { summary: NonNullable<ReturnType<typeof useMedicalRecords>['patient']>['telemetrySummary'] }) {
  if (!summary) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-500" />
          Latest Vitals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Heart Rate</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {summary.latestHeartRate?.toFixed(0) ?? '-'} <span className="text-xs font-normal">bpm</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">SpO2</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {summary.latestSpO2?.toFixed(1) ?? '-'} <span className="text-xs font-normal">%</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Avg Heart Rate</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {summary.averageHeartRate?.toFixed(0) ?? '-'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">HRV Mean</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {summary.hrvMean?.toFixed(1) ?? '-'} <span className="text-xs font-normal">ms</span>
            </p>
          </div>
        </div>
        {summary.lastUpdated && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Last updated: {new Date(summary.lastUpdated).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function RecordsPage() {
  const user = useAuthStore((s) => s.user);
  const patientId = user?.id ?? '';
  const { patient, isLoading } = useMedicalRecords(patientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center py-24">
        <FileText className="mb-4 h-12 w-12 text-slate-300" />
        <p className="text-sm text-slate-500">No medical records found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Medical Records</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {patient.firstName} {patient.lastName} | {patient.auraId} | {patient.gender}, DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
        </p>
      </div>

      <VitalsSummarySection summary={patient.telemetrySummary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConditionsSection prescriptions={patient.prescriptions} />
        <MedicationsSection prescriptions={patient.prescriptions} />
      </div>

      <TriageSection triageHistory={patient.triageHistory} />
    </div>
  );
}
