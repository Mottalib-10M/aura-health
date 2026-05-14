import { useState } from 'react';
import { Building2, Plus, Edit, Users, BedDouble } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface Department {
  id: string;
  name: string;
  headDoctor: string;
  totalBeds: number;
  occupiedBeds: number;
  staffCount: number;
  status: 'active' | 'full' | 'closed';
}

const mockDepartments: Department[] = [
  { id: '1', name: 'Emergency Medicine', headDoctor: 'Dr. Alisher Karimov', totalBeds: 40, occupiedBeds: 35, staffCount: 52, status: 'active' },
  { id: '2', name: 'Cardiology', headDoctor: 'Dr. Nilufar Yusupova', totalBeds: 30, occupiedBeds: 28, staffCount: 38, status: 'active' },
  { id: '3', name: 'Internal Medicine', headDoctor: 'Dr. Sardor Rakhimov', totalBeds: 50, occupiedBeds: 50, staffCount: 45, status: 'full' },
  { id: '4', name: 'Surgery', headDoctor: 'Dr. Javlon Mirzayev', totalBeds: 35, occupiedBeds: 22, staffCount: 40, status: 'active' },
  { id: '5', name: 'Pediatrics', headDoctor: 'Dr. Gulnora Sharipova', totalBeds: 25, occupiedBeds: 18, staffCount: 30, status: 'active' },
  { id: '6', name: 'Obstetrics & Gynecology', headDoctor: 'Dr. Nodira Mirzayeva', totalBeds: 20, occupiedBeds: 15, staffCount: 28, status: 'active' },
  { id: '7', name: 'Neurology', headDoctor: 'Dr. Timur Abdullaev', totalBeds: 20, occupiedBeds: 16, staffCount: 22, status: 'active' },
  { id: '8', name: 'Radiology', headDoctor: 'Dr. Aziza Tursunova', totalBeds: 0, occupiedBeds: 0, staffCount: 15, status: 'active' },
];

// ---------------------------------------------------------------------------
// Department Card
// ---------------------------------------------------------------------------

function DepartmentCard({ dept, onEdit }: { dept: Department; onEdit: () => void }) {
  const occupancy = dept.totalBeds > 0 ? Math.round((dept.occupiedBeds / dept.totalBeds) * 100) : 0;
  const occupancyColor =
    occupancy >= 95 ? 'text-red-600 dark:text-red-400'
    : occupancy >= 80 ? 'text-amber-600 dark:text-amber-400'
    : 'text-green-600 dark:text-green-400';

  const barColor =
    occupancy >= 95 ? 'bg-red-500'
    : occupancy >= 80 ? 'bg-amber-500'
    : 'bg-green-500';

  return (
    <Card hoverable>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950">
              <Building2 className="h-5 w-5 text-primary-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {dept.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Head: {dept.headDoctor}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={dept.status === 'full' ? 'error' : dept.status === 'closed' ? 'default' : 'success'}
              dot
              size="sm"
            >
              {dept.status}
            </Badge>
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{dept.totalBeds}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Beds</p>
          </div>
          <div className="text-center">
            <p className={cn('text-lg font-bold', occupancyColor)}>{occupancy}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Occupancy</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{dept.staffCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Staff</p>
          </div>
        </div>

        {/* Occupancy Bar */}
        {dept.totalBeds > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Bed Occupancy</span>
              <span>{dept.occupiedBeds}/{dept.totalBeds}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${occupancy}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function DepartmentsPage() {
  const [isLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingDept(null);
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalBeds = mockDepartments.reduce((s, d) => s + d.totalBeds, 0);
  const occupiedBeds = mockDepartments.reduce((s, d) => s + d.occupiedBeds, 0);
  const totalStaff = mockDepartments.reduce((s, d) => s + d.staffCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Departments
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage hospital departments, beds, and staff allocation
          </p>
        </div>
        <Button variant="primary" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="h-8 w-8 text-primary-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{mockDepartments.length}</p>
              <p className="text-xs text-slate-500">Departments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BedDouble className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalBeds}</p>
              <p className="text-xs text-slate-500">Total Beds</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BedDouble className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round((occupiedBeds / totalBeds) * 100)}%</p>
              <p className="text-xs text-slate-500">Avg. Occupancy</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalStaff}</p>
              <p className="text-xs text-slate-500">Total Staff</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockDepartments.map((dept) => (
          <DepartmentCard key={dept.id} dept={dept} onEdit={() => handleEdit(dept)} />
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingDept ? 'Edit Department' : 'Add Department'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setShowModal(false)}>
              {editingDept ? 'Save Changes' : 'Create Department'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Department Name" defaultValue={editingDept?.name ?? ''} />
          <Input label="Head Doctor" defaultValue={editingDept?.headDoctor ?? ''} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Total Beds" type="number" defaultValue={String(editingDept?.totalBeds ?? '')} />
            <Input label="Staff Count" type="number" defaultValue={String(editingDept?.staffCount ?? '')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
