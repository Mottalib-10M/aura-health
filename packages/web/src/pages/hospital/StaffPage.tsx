import { useState, useMemo } from 'react';
import { Search, Plus, Filter, UserCog, Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface StaffMember {
  id: string;
  name: string;
  role: 'doctor' | 'nurse' | 'technician' | 'admin' | 'specialist';
  department: string;
  status: 'on-duty' | 'off-duty' | 'on-leave' | 'available';
  email: string;
  phone: string;
  joinDate: string;
}

const mockStaff: StaffMember[] = [
  { id: '1', name: 'Dr. Alisher Karimov', role: 'doctor', department: 'Emergency Medicine', status: 'on-duty', email: 'a.karimov@aura.health', phone: '+998 90 111 0001', joinDate: '2018-03-15' },
  { id: '2', name: 'Dr. Nilufar Yusupova', role: 'doctor', department: 'Cardiology', status: 'on-duty', email: 'n.yusupova@aura.health', phone: '+998 90 111 0002', joinDate: '2019-06-01' },
  { id: '3', name: 'Nurse Zarina Ibragimova', role: 'nurse', department: 'Emergency Medicine', status: 'on-duty', email: 'z.ibragimova@aura.health', phone: '+998 90 111 0003', joinDate: '2020-01-10' },
  { id: '4', name: 'Dr. Sardor Rakhimov', role: 'doctor', department: 'Internal Medicine', status: 'off-duty', email: 's.rakhimov@aura.health', phone: '+998 90 111 0004', joinDate: '2017-09-20' },
  { id: '5', name: 'Tech. Umid Tashkentov', role: 'technician', department: 'Radiology', status: 'available', email: 'u.tashkentov@aura.health', phone: '+998 90 111 0005', joinDate: '2021-04-05' },
  { id: '6', name: 'Dr. Gulnora Sharipova', role: 'specialist', department: 'Pediatrics', status: 'on-leave', email: 'g.sharipova@aura.health', phone: '+998 90 111 0006', joinDate: '2016-11-12' },
  { id: '7', name: 'Nurse Behzod Normatov', role: 'nurse', department: 'Surgery', status: 'on-duty', email: 'b.normatov@aura.health', phone: '+998 90 111 0007', joinDate: '2022-02-28' },
  { id: '8', name: 'Admin Kamola Azimova', role: 'admin', department: 'Administration', status: 'available', email: 'k.azimova@aura.health', phone: '+998 90 111 0008', joinDate: '2019-08-15' },
];

const statusConfig: Record<StaffMember['status'], { variant: 'success' | 'default' | 'warning' | 'info'; label: string }> = {
  'on-duty': { variant: 'success', label: 'On Duty' },
  'off-duty': { variant: 'default', label: 'Off Duty' },
  'on-leave': { variant: 'warning', label: 'On Leave' },
  'available': { variant: 'info', label: 'Available' },
};

const roleConfig: Record<StaffMember['role'], string> = {
  doctor: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  nurse: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  technician: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  admin: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  specialist: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function StaffPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isLoading] = useState(false);

  const filteredStaff = useMemo(() => {
    let result = mockStaff;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'all') {
      result = result.filter((s) => s.role === roleFilter);
    }
    return result;
  }, [searchQuery, roleFilter]);

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
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage hospital staff directory and assignments
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name, department, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {['all', 'doctor', 'nurse', 'technician', 'specialist', 'admin'].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors',
                roleFilter === role
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing {filteredStaff.length} of {mockStaff.length} staff members
      </p>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Department</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filteredStaff.map((staff) => {
                const status = statusConfig[staff.status];
                return (
                  <tr key={staff.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold', roleConfig[staff.role])}>
                          {staff.name.split(' ').slice(-2).map((n) => n[0]).join('')}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{staff.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="default" size="sm" className="capitalize">{staff.role}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{staff.department}</td>
                    <td className="px-5 py-3">
                      <Badge variant={status.variant} dot size="sm">{status.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <a href={`mailto:${staff.email}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300">
                          <Mail className="h-4 w-4" />
                        </a>
                        <a href={`tel:${staff.phone}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300">
                          <Phone className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStaff.length === 0 && (
          <div className="flex flex-col items-center py-12">
            <UserCog className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No staff members match your search
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
