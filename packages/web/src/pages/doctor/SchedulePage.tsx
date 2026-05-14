import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Video, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  patientName?: string;
  type: 'telemedicine' | 'in-person' | 'available' | 'blocked';
  status?: 'confirmed' | 'pending';
}

const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
  return weekDays.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function generateMockSlots(): Record<string, TimeSlot[]> {
  const slots: Record<string, TimeSlot[]> = {};
  const patients = [
    'Aziz Rakhimov', 'Malika Karimova', 'Javlon Yusupov',
    'Dilnoza Abdullaeva', 'Bobur Tursunov', 'Nodira Mirzayeva',
  ];
  const types: Array<'telemedicine' | 'in-person'> = ['telemedicine', 'in-person'];

  weekDays.forEach((day, dayIdx) => {
    const daySlots: TimeSlot[] = [];
    hours.forEach((hour, hourIdx) => {
      const hasAppointment = Math.random() > 0.6;
      if (hasAppointment) {
        const type = types[Math.floor(Math.random() * 2)];
        daySlots.push({
          id: `${dayIdx}-${hourIdx}`,
          startTime: hour,
          endTime: hours[hourIdx + 1] ?? '18:00',
          patientName: patients[Math.floor(Math.random() * patients.length)],
          type,
          status: Math.random() > 0.3 ? 'confirmed' : 'pending',
        });
      } else if (Math.random() > 0.7) {
        daySlots.push({
          id: `${dayIdx}-${hourIdx}`,
          startTime: hour,
          endTime: hours[hourIdx + 1] ?? '18:00',
          type: 'blocked',
        });
      } else {
        daySlots.push({
          id: `${dayIdx}-${hourIdx}`,
          startTime: hour,
          endTime: hours[hourIdx + 1] ?? '18:00',
          type: 'available',
        });
      }
    });
    slots[day] = daySlots;
  });

  return slots;
}

// ---------------------------------------------------------------------------
// Slot Cell
// ---------------------------------------------------------------------------

function SlotCell({ slot }: { slot: TimeSlot }) {
  if (slot.type === 'available') {
    return (
      <div className="group flex h-full min-h-[3rem] items-center justify-center rounded-lg border border-dashed border-slate-200 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:hover:border-primary-700 dark:hover:bg-primary-950">
        <Plus className="h-4 w-4 text-slate-300 transition-colors group-hover:text-primary-500 dark:text-slate-600" />
      </div>
    );
  }

  if (slot.type === 'blocked') {
    return (
      <div className="flex h-full min-h-[3rem] items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/50">
        <span className="text-xs text-slate-400">Blocked</span>
      </div>
    );
  }

  const isTelemedicine = slot.type === 'telemedicine';

  return (
    <div
      className={cn(
        'flex h-full min-h-[3rem] flex-col justify-between rounded-lg border p-2 text-xs transition-shadow hover:shadow-md',
        isTelemedicine
          ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50'
          : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50',
      )}
    >
      <div>
        <p className={cn(
          'font-medium',
          isTelemedicine ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200',
        )}>
          {slot.patientName}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="flex items-center gap-0.5">
          {isTelemedicine ? (
            <Video className={cn('h-3 w-3', isTelemedicine ? 'text-blue-500' : 'text-green-500')} />
          ) : (
            <MapPin className="h-3 w-3 text-green-500" />
          )}
          <span className={cn(
            isTelemedicine ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400',
          )}>
            {isTelemedicine ? 'Video' : 'In-person'}
          </span>
        </span>
        {slot.status === 'pending' && (
          <Badge variant="warning" size="sm">Pending</Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoading] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const slots = useMemo(() => generateMockSlots(), []);

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

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
            Schedule
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your weekly appointment calendar
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4" />
          Add Availability
        </Button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {weekLabel}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
          Today
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-900" />
          Telemedicine
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900" />
          In-Person
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-dashed border-slate-300 dark:border-slate-600" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-slate-100 dark:bg-slate-800" />
          Blocked
        </span>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="w-20 px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Clock className="h-4 w-4" />
                  </th>
                  {weekDays.map((day, i) => (
                    <th key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="block">{day}</span>
                      <span className="text-slate-400 dark:text-slate-500">
                        {weekDates[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour, hourIdx) => (
                  <tr key={hour} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {hour}
                    </td>
                    {weekDays.map((day) => {
                      const daySlots = slots[day] ?? [];
                      const slot = daySlots[hourIdx];
                      return (
                        <td key={`${day}-${hour}`} className="px-1 py-1">
                          {slot ? <SlotCell slot={slot} /> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
