import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  CalendarDays,
  Activity,
  Users,
  Building2,
  BarChart3,
  ShieldCheck,
  Truck,
  FileText,
  Heart,
  ClipboardList,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore, type UserRole } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Navigation definitions per role
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const patientNav: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
      { label: 'Symptom Triage', href: '/patient/triage', icon: Stethoscope },
      { label: 'Appointments', href: '/patient/appointments', icon: CalendarDays },
      { label: 'Telemetry', href: '/patient/telemetry', icon: Activity },
    ],
  },
  {
    title: 'Records',
    items: [
      { label: 'Medical Records', href: '/patient/records', icon: FileText },
      { label: 'Wearable Devices', href: '/patient/devices', icon: Heart },
    ],
  },
];

const doctorNav: NavSection[] = [
  {
    title: 'Clinical',
    items: [
      { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard },
      { label: 'Patients', href: '/doctor/patients', icon: Users },
      { label: 'Schedule', href: '/doctor/schedule', icon: CalendarDays },
      { label: 'Efficacy', href: '/doctor/efficacy', icon: BarChart3 },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Triage Review', href: '/doctor/triage-review', icon: ClipboardList },
      { label: 'Telemetry', href: '/doctor/telemetry', icon: Activity },
    ],
  },
];

const hospitalNav: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard', href: '/hospital/dashboard', icon: LayoutDashboard },
      { label: 'Departments', href: '/hospital/departments', icon: Building2 },
      { label: 'Staff', href: '/hospital/staff', icon: UserCog },
      { label: 'Resources', href: '/hospital/resources', icon: Truck },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Reports', href: '/hospital/reports', icon: BarChart3 },
    ],
  },
];

const analystNav: NavSection[] = [
  {
    title: 'Surveillance',
    items: [
      { label: 'Dashboard', href: '/analyst/dashboard', icon: LayoutDashboard },
      { label: 'Disease Map', href: '/analyst/surveillance', icon: ShieldCheck },
      { label: 'Outbreaks', href: '/analyst/outbreaks', icon: Activity },
    ],
  },
  {
    title: 'Supply Chain',
    items: [
      { label: 'Forecasting', href: '/analyst/supply-chain', icon: Truck },
      { label: 'Reports', href: '/analyst/reports', icon: BarChart3 },
    ],
  },
];

const navByRole: Record<UserRole, NavSection[]> = {
  patient: patientNav,
  doctor: doctorNav,
  hospital_admin: hospitalNav,
  analyst: analystNav,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const role = user?.role ?? 'patient';
  const sections = navByRole[role];

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300',
        'dark:border-slate-700 dark:bg-slate-900',
        collapsed ? 'w-16' : 'w-64',
      )}
      aria-label="Main navigation"
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Aura
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-sm font-bold text-white">A</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-3 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {section.items.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                        collapsed && 'justify-center px-2',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5 flex-shrink-0',
                          isActive ? 'text-primary-600 dark:text-primary-400' : '',
                        )}
                        aria-hidden="true"
                      />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer actions */}
      <div className="border-t border-slate-100 p-2 dark:border-slate-800">
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
            'text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700',
            'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300',
            collapsed && 'justify-center px-2',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={() => logout()}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
            'text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600',
            'dark:text-slate-400 dark:hover:bg-red-950 dark:hover:text-red-400',
            collapsed && 'justify-center px-2',
          )}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
