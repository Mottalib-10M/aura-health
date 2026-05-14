import { useState } from 'react';
import { Package, Monitor, DoorOpen, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface Equipment {
  id: string;
  name: string;
  category: string;
  department: string;
  status: 'available' | 'in-use' | 'maintenance' | 'out-of-order';
  lastMaintenance: string;
  quantity: number;
}

interface Room {
  id: string;
  number: string;
  type: 'OR' | 'ICU' | 'Ward' | 'Exam' | 'Lab';
  floor: number;
  available: boolean;
  currentPatient?: string;
}

interface Supply {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  lastRestocked: string;
}

const mockEquipment: Equipment[] = [
  { id: '1', name: 'Ventilator', category: 'Critical Care', department: 'ICU', status: 'in-use', lastMaintenance: '2026-04-15', quantity: 12 },
  { id: '2', name: 'Defibrillator', category: 'Emergency', department: 'Emergency', status: 'available', lastMaintenance: '2026-05-01', quantity: 8 },
  { id: '3', name: 'Ultrasound Machine', category: 'Imaging', department: 'Radiology', status: 'available', lastMaintenance: '2026-04-20', quantity: 5 },
  { id: '4', name: 'X-Ray Machine', category: 'Imaging', department: 'Radiology', status: 'maintenance', lastMaintenance: '2026-03-10', quantity: 3 },
  { id: '5', name: 'ECG Monitor', category: 'Cardiology', department: 'Cardiology', status: 'in-use', lastMaintenance: '2026-05-05', quantity: 15 },
  { id: '6', name: 'Infusion Pump', category: 'General', department: 'Various', status: 'available', lastMaintenance: '2026-04-25', quantity: 40 },
  { id: '7', name: 'Surgical Robot', category: 'Surgery', department: 'Surgery', status: 'out-of-order', lastMaintenance: '2026-02-28', quantity: 1 },
];

const mockRooms: Room[] = [
  { id: '1', number: 'OR-1', type: 'OR', floor: 3, available: false, currentPatient: 'A. Rakhimov' },
  { id: '2', number: 'OR-2', type: 'OR', floor: 3, available: true },
  { id: '3', number: 'OR-3', type: 'OR', floor: 3, available: false, currentPatient: 'M. Karimova' },
  { id: '4', number: 'ICU-1', type: 'ICU', floor: 2, available: false, currentPatient: 'B. Tursunov' },
  { id: '5', number: 'ICU-2', type: 'ICU', floor: 2, available: true },
  { id: '6', number: 'ICU-3', type: 'ICU', floor: 2, available: false, currentPatient: 'S. Nishanov' },
  { id: '7', number: 'ICU-4', type: 'ICU', floor: 2, available: true },
  { id: '8', number: 'EXAM-1', type: 'Exam', floor: 1, available: true },
  { id: '9', number: 'EXAM-2', type: 'Exam', floor: 1, available: false, currentPatient: 'D. Abdullaeva' },
  { id: '10', number: 'EXAM-3', type: 'Exam', floor: 1, available: true },
  { id: '11', number: 'LAB-1', type: 'Lab', floor: 1, available: true },
  { id: '12', number: 'LAB-2', type: 'Lab', floor: 1, available: false },
];

const mockSupplies: Supply[] = [
  { id: '1', name: 'Surgical Masks (N95)', category: 'PPE', currentStock: 150, minStock: 500, unit: 'boxes', lastRestocked: '2026-05-10' },
  { id: '2', name: 'Nitrile Gloves', category: 'PPE', currentStock: 2000, minStock: 500, unit: 'pairs', lastRestocked: '2026-05-12' },
  { id: '3', name: 'IV Saline (0.9%)', category: 'Fluids', currentStock: 80, minStock: 200, unit: 'bags', lastRestocked: '2026-05-08' },
  { id: '4', name: 'Syringes (10ml)', category: 'Consumables', currentStock: 1500, minStock: 300, unit: 'units', lastRestocked: '2026-05-11' },
  { id: '5', name: 'Wound Dressings', category: 'Consumables', currentStock: 45, minStock: 100, unit: 'packs', lastRestocked: '2026-05-05' },
  { id: '6', name: 'Oxygen Cylinders', category: 'Medical Gas', currentStock: 12, minStock: 20, unit: 'cylinders', lastRestocked: '2026-05-09' },
  { id: '7', name: 'Blood Collection Tubes', category: 'Lab', currentStock: 800, minStock: 200, unit: 'units', lastRestocked: '2026-05-13' },
];

const equipmentStatusConfig: Record<Equipment['status'], { variant: 'success' | 'info' | 'warning' | 'error'; label: string }> = {
  'available': { variant: 'success', label: 'Available' },
  'in-use': { variant: 'info', label: 'In Use' },
  'maintenance': { variant: 'warning', label: 'Maintenance' },
  'out-of-order': { variant: 'error', label: 'Out of Order' },
};

const roomTypeColors: Record<Room['type'], string> = {
  OR: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  ICU: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  Ward: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  Exam: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  Lab: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function ResourcesPage() {
  const [isLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const lowStockItems = mockSupplies.filter((s) => s.currentStock < s.minStock);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Resources
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage equipment inventory, room availability, and supply levels
        </p>
      </div>

      {/* Low stock warning */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Low Stock Warning
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {lowStockItems.length} item{lowStockItems.length > 1 ? 's are' : ' is'} below minimum stock levels: {lowStockItems.map((i) => i.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Equipment Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-500" />
            Equipment Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Equipment</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Category</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Department</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Qty</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Status</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">Last Maintenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {mockEquipment.map((eq) => {
                  const status = equipmentStatusConfig[eq.status];
                  return (
                    <tr key={eq.id}>
                      <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">{eq.name}</td>
                      <td className="py-2.5 text-slate-500">{eq.category}</td>
                      <td className="py-2.5 text-slate-500">{eq.department}</td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">{eq.quantity}</td>
                      <td className="py-2.5"><Badge variant={status.variant} size="sm" dot>{status.label}</Badge></td>
                      <td className="py-2.5 text-slate-500">{new Date(eq.lastMaintenance).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Room Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-green-500" />
            Room Availability
            <Badge variant="default" size="sm">
              {mockRooms.filter((r) => r.available).length}/{mockRooms.length} available
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {mockRooms.map((room) => (
              <div
                key={room.id}
                className={cn(
                  'rounded-lg border p-3 text-center transition-shadow hover:shadow-sm',
                  room.available
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50',
                )}
              >
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{room.number}</p>
                <Badge className={cn('mt-1', roomTypeColors[room.type])} size="sm">{room.type}</Badge>
                <p className="mt-1 text-2xs text-slate-500">Floor {room.floor}</p>
                {room.available ? (
                  <p className="mt-1 flex items-center justify-center gap-1 text-2xs text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" /> Available
                  </p>
                ) : (
                  <p className="mt-1 text-2xs text-slate-400">{room.currentPatient}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supply Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            Supply Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockSupplies.map((supply) => {
              const isLow = supply.currentStock < supply.minStock;
              const percentage = Math.min((supply.currentStock / (supply.minStock * 2)) * 100, 100);

              return (
                <div key={supply.id} className="flex items-center gap-4">
                  <div className="w-48 flex-shrink-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{supply.name}</p>
                    <p className="text-xs text-slate-500">{supply.category}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          isLow ? 'bg-red-500' : 'bg-green-500',
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <span className={cn('text-sm font-semibold', isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100')}>
                      {supply.currentStock}
                    </span>
                    <span className="text-xs text-slate-500"> {supply.unit}</span>
                  </div>
                  {isLow && (
                    <Badge variant="error" size="sm" dot>Low</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
