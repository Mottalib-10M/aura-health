import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, User, Calendar, X, Plus, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { usePatients, type PatientRow } from '@/hooks/usePatients';
import { gqlRequest } from '@/services/api';
import { CREATE_APPOINTMENT, CREATE_PATIENT } from '@/services/graphql/mutations';

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
// Create Appointment Modal
// ---------------------------------------------------------------------------

function CreateAppointmentModal({
  open,
  onClose,
  patient,
  doctorId,
}: {
  open: boolean;
  onClose: () => void;
  patient: PatientRow | null;
  doctorId: string;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<string>('NON_URGENT');

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      gqlRequest<{ createAppointment: unknown }>(CREATE_APPOINTMENT, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onClose();
      setReason('');
      setUrgency('NON_URGENT');
    },
  });

  if (!patient) return null;

  const handleSubmit = () => {
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    createMutation.mutate({
      patientId: patient.id,
      doctorId,
      specialty: 'general',
      preferredDate: date,
      preferredTimeStart: time,
      preferredTimeEnd: `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:${time.split(':')[1]}`,
      urgencyLevel: urgency,
      reason: reason || 'Consultation',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Appointment"
      description={`New appointment for ${patient.firstName} ${patient.lastName}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending || !date || !time}>
            {createMutation.isPending ? 'Scheduling...' : 'Schedule Appointment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {createMutation.isError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Failed to create appointment. Please try again.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              min="08:00"
              max="17:00"
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Urgency
          </label>
          <div className="flex gap-2">
            {[
              { value: 'NON_URGENT', label: 'Standard' },
              { value: 'SEMI_URGENT', label: 'Semi-Urgent' },
              { value: 'URGENT', label: 'Urgent' },
              { value: 'EMERGENCY', label: 'Emergency' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUrgency(opt.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  urgency === opt.value
                    ? 'bg-primary-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason for appointment (e.g., Follow-up checkup, Lab results review...)"
            className={cn(
              'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
              'text-slate-900 placeholder:text-slate-400',
              'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
              'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
            )}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Patient Modal
// ---------------------------------------------------------------------------

function CreatePatientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      gqlRequest<{ createPatient: unknown }>(CREATE_PATIENT, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setGender('');
    setRegion('');
    setCity('');
    setEmail('');
  };

  const handleSubmit = () => {
    createMutation.mutate({
      firstName,
      lastName,
      dateOfBirth,
      gender,
      region,
      city,
      ...(email ? { email } : {}),
    });
  };

  const isValid = firstName && lastName && dateOfBirth && gender && region && city;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Patient"
      description="Create a patient record. The patient can set their password later."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending || !isValid}>
            {createMutation.isPending ? 'Creating...' : 'Create Patient'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {createMutation.isError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {createMutation.error?.message?.includes('duplicate')
              ? 'A patient with this email already exists.'
              : createMutation.error?.message || 'Failed to create patient. Please try again.'}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gender <span className="text-red-500">*</span>
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Region <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Tashkent"
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Tashkent"
              className={cn(
                'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                'text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
              )}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email <span className="text-xs text-slate-400">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="patient@example.com"
            className={cn(
              'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
              'text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
              'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
            )}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Patient Detail Panel
// ---------------------------------------------------------------------------

function PatientDetail({
  patient,
  onClose,
  onSchedule,
}: {
  patient: PatientRow;
  onClose: () => void;
  onSchedule: (patient: PatientRow) => void;
}) {
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
          <Button variant="outline" size="sm" onClick={() => onSchedule(patient)}>
            <Plus className="h-4 w-4" />
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
  const { patients, isLoading, isError, error } = usePatients(doctorId);

  console.log('[PatientsPage] doctorId:', doctorId, 'patients:', patients.length, 'isError:', isError, 'error:', error?.message);

  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [appointmentPatient, setAppointmentPatient] = useState<PatientRow | null>(null);
  const [showCreatePatient, setShowCreatePatient] = useState(false);

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

  if (isError) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Error loading patients</p>
          <p className="text-sm mt-1">{error?.message || 'Unknown error'}</p>
          <p className="text-xs mt-2 text-red-600">Doctor ID: {doctorId || 'empty'}</p>
        </div>
      </div>
    );
  }

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Patient List</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and review your patients
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreatePatient(true)}>
          <Plus className="h-4 w-4" />
          Add Patient
        </Button>
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
                        <PatientDetail
                          patient={patient}
                          onClose={() => setExpandedPatient(null)}
                          onSchedule={setAppointmentPatient}
                        />
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
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setExpandedPatient(patient.id)}>
                              <ChevronDown className="h-4 w-4" />
                              Details
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setAppointmentPatient(patient)}>
                              <Clock className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Create Appointment Modal */}
      <CreateAppointmentModal
        open={appointmentPatient !== null}
        onClose={() => setAppointmentPatient(null)}
        patient={appointmentPatient}
        doctorId={doctorId}
      />

      {/* Create Patient Modal */}
      <CreatePatientModal
        open={showCreatePatient}
        onClose={() => setShowCreatePatient(false)}
      />
    </div>
  );
}
