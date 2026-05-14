import { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, User, Phone, Mail, Calendar, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  lastVisit: string;
  triageStatus: 'low' | 'moderate' | 'high' | 'critical' | 'emergency';
  phone: string;
  email: string;
  conditions: string[];
  nextAppointment?: string;
}

const mockPatients: PatientRow[] = [
  { id: '1', firstName: 'Aziz', lastName: 'Rakhimov', age: 45, gender: 'Male', lastVisit: '2026-05-10', triageStatus: 'critical', phone: '+998 90 111 2222', email: 'aziz@email.com', conditions: ['Diabetes', 'Hypertension'], nextAppointment: '2026-05-20' },
  { id: '2', firstName: 'Malika', lastName: 'Karimova', age: 32, gender: 'Female', lastVisit: '2026-05-12', triageStatus: 'moderate', phone: '+998 90 333 4444', email: 'malika@email.com', conditions: ['Asthma'] },
  { id: '3', firstName: 'Javlon', lastName: 'Yusupov', age: 67, gender: 'Male', lastVisit: '2026-05-08', triageStatus: 'high', phone: '+998 90 555 6666', email: 'javlon@email.com', conditions: ['COPD', 'Heart Failure'], nextAppointment: '2026-05-18' },
  { id: '4', firstName: 'Dilnoza', lastName: 'Abdullaeva', age: 28, gender: 'Female', lastVisit: '2026-05-14', triageStatus: 'low', phone: '+998 90 777 8888', email: 'dilnoza@email.com', conditions: ['Allergies'] },
  { id: '5', firstName: 'Bobur', lastName: 'Tursunov', age: 55, gender: 'Male', lastVisit: '2026-04-28', triageStatus: 'emergency', phone: '+998 90 999 0000', email: 'bobur@email.com', conditions: ['Acute MI', 'Diabetes'], nextAppointment: '2026-05-15' },
  { id: '6', firstName: 'Nodira', lastName: 'Mirzayeva', age: 41, gender: 'Female', lastVisit: '2026-05-05', triageStatus: 'moderate', phone: '+998 91 222 3333', email: 'nodira@email.com', conditions: ['Hypothyroidism'] },
  { id: '7', firstName: 'Sardor', lastName: 'Nishanov', age: 73, gender: 'Male', lastVisit: '2026-05-01', triageStatus: 'high', phone: '+998 91 444 5555', email: 'sardor@email.com', conditions: ['Renal Disease', 'Hypertension'] },
  { id: '8', firstName: 'Gulnora', lastName: 'Sharipova', age: 36, gender: 'Female', lastVisit: '2026-05-13', triageStatus: 'low', phone: '+998 91 666 7777', email: 'gulnora@email.com', conditions: ['Migraine'] },
];

// ---------------------------------------------------------------------------
// Patient Detail Panel
// ---------------------------------------------------------------------------

function PatientDetail({ patient, onClose }: { patient: PatientRow; onClose: () => void }) {
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
                {patient.age} years old, {patient.gender}
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
              <Phone className="h-4 w-4" />
              {patient.phone}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Mail className="h-4 w-4" />
              {patient.email}
            </div>
            {patient.nextAppointment && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                Next: {new Date(patient.nextAppointment).toLocaleDateString()}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Conditions</p>
            <div className="flex flex-wrap gap-1">
              {patient.conditions.map((c) => (
                <Badge key={c} variant="default" size="sm">{c}</Badge>
              ))}
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Triage Status</p>
              <UrgencyBadge level={patient.triageStatus} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button variant="primary" size="sm">View Full Record</Button>
          <Button variant="outline" size="sm">Schedule Appointment</Button>
          <Button variant="ghost" size="sm">Message Patient</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [isLoading] = useState(false);

  const filteredPatients = useMemo(() => {
    let result = mockPatients;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.conditions.some((c) => c.toLowerCase().includes(q)),
      );
    }
    if (urgencyFilter !== 'all') {
      result = result.filter((p) => p.triageStatus === urgencyFilter);
    }
    return result;
  }, [searchQuery, urgencyFilter]);

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Patient List
        </h1>
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
          {['all', 'emergency', 'critical', 'high', 'moderate', 'low'].map((level) => (
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
        Showing {filteredPatients.length} of {mockPatients.length} patients
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
              {filteredPatients.map((patient) => (
                <>
                  <tr
                    key={patient.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() =>
                      setExpandedPatient(expandedPatient === patient.id ? null : patient.id)
                    }
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
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
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{patient.age}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(patient.lastVisit).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <UrgencyBadge level={patient.triageStatus} />
                    </td>
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm">
                        {expandedPatient === patient.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        Details
                      </Button>
                    </td>
                  </tr>
                  {expandedPatient === patient.id && (
                    <tr key={`${patient.id}-detail`}>
                      <td colSpan={5} className="px-5 py-3">
                        <PatientDetail
                          patient={patient}
                          onClose={() => setExpandedPatient(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPatients.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <User className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No patients match your search
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
