import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, User, Calendar, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { usePatients, type PatientRow } from '@/hooks/usePatients';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function latestUrgency(patient: PatientRow): 'low' | 'moderate' | 'high' | 'critical' | 'emergency' {
  const latest = patient.triageHistory?.[0];
  if (!latest) return 'low';
  switch (latest.urgencyLevel) {
    case 'EMERGENCY': return 'emergency';
    case 'URGENT': return 'high';
    case 'SEMI_URGENT': return 'moderate';
    default: return 'low';
  }
}

function lastVisitDate(patient: PatientRow): string | null {
  const completed = patient.appointments?.filter(a => a.status === 'COMPLETED');
  if (!completed || completed.length === 0) return null;
  return completed.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0].scheduledAt;
}

function nextAppointmentDate(patient: PatientRow): string | null {
  const upcoming = patient.appointments?.filter(a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED');
  if (!upcoming || upcoming.length === 0) return null;
  return upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0].scheduledAt;
}

function conditionsFromPrescriptions(patient: PatientRow): string[] {
  const codes = new Set<string>();
  patient.prescriptions?.forEach(p => p.diagnosisCodes?.forEach(c => codes.add(c)));
  return Array.from(codes);
}

// ---------------------------------------------------------------------------
// Patient Detail Panel
// ---------------------------------------------------------------------------

function PatientDetail({ patient, onClose }: { patient: PatientRow; onClose: () => void }) {
  const navigate = useNavigate();
  const age = calcAge(patient.dateOfBirth);
  const urgency = latestUrgency(patient);
  const conditions = conditionsFromPrescriptions(patient);
  const nextApt = nextAppointmentDate(patient);

  return (
    <Card className="border-primary-200 dark:border-primary-800">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {patient.firstName} {patient.lastName}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {age} years old, {patient.gender} | {patient.region}, {patient.city}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">Blood Type:</span> {patient.bloodType ?? 'Unknown'}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">Aura ID:</span> {patient.auraId}
            </div>
            {nextApt && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                Next: {new Date(nextApt).toLocaleDateString()}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Diagnosis Codes</p>
            <div className="flex flex-wrap gap-1">
              {conditions.length > 0 ? conditions.map((c) => (
                <Badge key={c} variant="default" size="sm">{c}</Badge>
              )) : (
                <span className="text-xs text-slate-400">None recorded</span>
              )}
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Triage Status</p>
              <UrgencyBadge level={urgency} />
            </div>
          </div>
        </div>

        {/* Vitals summary */}
        {patient.telemetrySummary && (
          <div className="mt-4 grid grid-cols-4 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-center">
              <p className="text-xs text-slate-500">Heart Rate</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {patient.telemetrySummary.latestHeartRate?.toFixed(0) ?? '-'} <span className="text-xs font-normal">bpm</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">SpO2</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {patient.telemetrySummary.latestSpO2?.toFixed(1) ?? '-'} <span className="text-xs font-normal">%</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Avg HR (24h)</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {patient.telemetrySummary.averageHeartRate?.toFixed(0) ?? '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Last Updated</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {patient.telemetrySummary.lastUpdated ? new Date(patient.telemetrySummary.lastUpdated).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button variant="primary" size="sm" onClick={() => navigate(`/doctor/telemetry?patientId=${patient.id}`)}>
            View Telemetry
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/doctor/schedule')}>
            Schedule Appointment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function PatientsPage() {
  const user = useAuthStore((s) => s.user);
  const doctorId = user?.id ?? '';
  const { patients, isLoading } = usePatients(doctorId);

  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    let result = patients;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.auraId.toLowerCase().includes(q) ||
          conditionsFromPrescriptions(p).some((c) => c.toLowerCase().includes(q)),
      );
    }
    if (urgencyFilter !== 'all') {
      result = result.filter((p) => latestUrgency(p) === urgencyFilter);
    }
    return result;
  }, [patients, searchQuery, urgencyFilter]);

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Patient List</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage and review your patients
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name or condition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {['all', 'emergency', 'high', 'moderate', 'low'].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setUrgencyFilter(level)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors',
                urgencyFilter === level
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing {filteredPatients.length} of {patients.length} patients
      </p>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Age</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Last Visit</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Triage Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filteredPatients.map((patient) => {
                const age = calcAge(patient.dateOfBirth);
                const urgency = latestUrgency(patient);
                const lastVisit = lastVisitDate(patient);
                return (
                  <tr key={patient.id}>
                    <td colSpan={expandedPatient === patient.id ? 5 : undefined} className={expandedPatient === patient.id ? 'px-5 py-3' : undefined}>
                      {expandedPatient === patient.id ? (
                        <PatientDetail patient={patient} onClose={() => setExpandedPatient(null)} />
                      ) : null}
                    </td>
                    {expandedPatient !== patient.id && (
                      <>
                        <td className="px-5 py-3">
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => setExpandedPatient(patient.id)}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {patient.firstName[0]}{patient.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{patient.gender}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{age}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                          {lastVisit ? new Date(lastVisit).toLocaleDateString() : 'No visits'}
                        </td>
                        <td className="px-5 py-3">
                          <UrgencyBadge level={urgency} />
                        </td>
                        <td className="px-5 py-3">
                          <Button variant="ghost" size="sm" onClick={() => setExpandedPatient(patient.id)}>
                            <ChevronDown className="h-4 w-4" />
                            Details
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredPatients.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <User className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {patients.length === 0 ? 'No patients found. Patients will appear here after appointments.' : 'No patients match your search'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
