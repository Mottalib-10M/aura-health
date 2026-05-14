import { useState } from 'react';
import { FileText, Download, Pill, AlertTriangle, FlaskConical, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const mockConditions = [
  { id: '1', name: 'Type 2 Diabetes', diagnosedDate: '2022-03-15', status: 'active', icdCode: 'E11' },
  { id: '2', name: 'Essential Hypertension', diagnosedDate: '2021-08-10', status: 'active', icdCode: 'I10' },
  { id: '3', name: 'Seasonal Allergic Rhinitis', diagnosedDate: '2019-05-01', status: 'managed', icdCode: 'J30.2' },
];

const mockMedications = [
  { id: '1', name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', prescribedBy: 'Dr. Karimov', startDate: '2022-03-20' },
  { id: '2', name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', prescribedBy: 'Dr. Karimov', startDate: '2021-08-15' },
  { id: '3', name: 'Cetirizine', dosage: '10mg', frequency: 'As needed', prescribedBy: 'Dr. Yusupova', startDate: '2019-05-05' },
];

const mockAllergies = [
  { id: '1', allergen: 'Penicillin', severity: 'high' as const, reaction: 'Anaphylaxis', verified: true },
  { id: '2', allergen: 'Peanuts', severity: 'moderate' as const, reaction: 'Hives, swelling', verified: true },
  { id: '3', allergen: 'Latex', severity: 'low' as const, reaction: 'Contact dermatitis', verified: false },
];

const mockLabResults = [
  { id: '1', test: 'HbA1c', value: '6.8%', normalRange: '< 5.7%', date: '2026-04-20', status: 'high' as const },
  { id: '2', test: 'Fasting Glucose', value: '132 mg/dL', normalRange: '70-100 mg/dL', date: '2026-04-20', status: 'high' as const },
  { id: '3', test: 'Total Cholesterol', value: '195 mg/dL', normalRange: '< 200 mg/dL', date: '2026-04-20', status: 'normal' as const },
  { id: '4', test: 'Blood Pressure', value: '128/82 mmHg', normalRange: '< 120/80 mmHg', date: '2026-04-20', status: 'high' as const },
  { id: '5', test: 'Creatinine', value: '0.9 mg/dL', normalRange: '0.7-1.3 mg/dL', date: '2026-04-20', status: 'normal' as const },
  { id: '6', test: 'Complete Blood Count', value: 'Normal', normalRange: '-', date: '2026-03-15', status: 'normal' as const },
];

// ---------------------------------------------------------------------------
// Section Components
// ---------------------------------------------------------------------------

function ConditionsSection() {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary-500" />
            Medical Conditions
            <Badge variant="default" size="sm">{mockConditions.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-3">
            {mockConditions.map((condition) => (
              <div
                key={condition.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {condition.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ICD: {condition.icdCode} | Diagnosed: {new Date(condition.diagnosedDate).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={condition.status === 'active' ? 'warning' : 'success'} dot>
                  {condition.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function MedicationsSection() {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-500" />
            Current Medications
            <Badge variant="default" size="sm">{mockMedications.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-3">
            {mockMedications.map((med) => (
              <div
                key={med.id}
                className="rounded-lg border border-slate-100 p-3 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {med.name} - {med.dosage}
                  </p>
                  <Badge variant="info" size="sm">{med.frequency}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Prescribed by {med.prescribedBy} | Since {new Date(med.startDate).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function AllergiesSection() {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between"
        >
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Allergies
            <Badge variant="default" size="sm">{mockAllergies.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-3">
            {mockAllergies.map((allergy) => (
              <div
                key={allergy.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {allergy.allergen}
                    </p>
                    {!allergy.verified && (
                      <Badge variant="warning" size="sm">Unverified</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Reaction: {allergy.reaction}
                  </p>
                </div>
                <Badge
                  variant={allergy.severity === 'high' ? 'critical' : allergy.severity === 'moderate' ? 'high' : 'moderate'}
                  dot
                >
                  {allergy.severity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function LabResultsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-500" />
          Lab Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Test</th>
                <th className="pb-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Result</th>
                <th className="pb-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Normal Range</th>
                <th className="pb-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Date</th>
                <th className="pb-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {mockLabResults.map((lab) => (
                <tr key={lab.id}>
                  <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    {lab.test}
                  </td>
                  <td className={cn(
                    'py-2.5',
                    lab.status === 'high' ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300',
                  )}>
                    {lab.value}
                  </td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">
                    {lab.normalRange}
                  </td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">
                    {new Date(lab.date).toLocaleDateString()}
                  </td>
                  <td className="py-2.5">
                    <Badge variant={lab.status === 'normal' ? 'success' : 'error'} size="sm">
                      {lab.status === 'normal' ? 'Normal' : 'Abnormal'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function RecordsPage() {
  const [isLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Medical Records
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            View and manage your complete medical history
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Download Records
        </Button>
      </div>

      {/* Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConditionsSection />
        <MedicationsSection />
      </div>
      <AllergiesSection />
      <LabResultsSection />
    </div>
  );
}
