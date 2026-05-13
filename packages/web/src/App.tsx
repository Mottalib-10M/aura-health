import { type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Spinner } from '@/components/ui/Spinner';

// Auth pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';

// Patient pages
import { PatientDashboard } from '@/pages/patient/PatientDashboard';
import { SymptomTriage } from '@/pages/patient/SymptomTriage';

// Doctor pages
import { DoctorDashboard } from '@/pages/doctor/DoctorDashboard';
import { EfficacyTracker } from '@/pages/doctor/EfficacyTracker';

// Hospital pages
import { HospitalDashboard } from '@/pages/hospital/HospitalDashboard';

// Analyst pages
import { AnalystDashboard } from '@/pages/analyst/AnalystDashboard';
import { SupplyChainPage } from '@/pages/analyst/SupplyChainPage';

// ---------------------------------------------------------------------------
// Protected Route Component
// ---------------------------------------------------------------------------

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-secondary dark:bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to user's own dashboard if they try to access unauthorized routes
    const roleRoutes: Record<UserRole, string> = {
      patient: '/patient/dashboard',
      doctor: '/doctor/dashboard',
      hospital_admin: '/hospital/dashboard',
      analyst: '/analyst/dashboard',
    };
    return <Navigate to={roleRoutes[user.role]} replace />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Dashboard Route Wrapper
// ---------------------------------------------------------------------------

function DashboardRoute({ children, allowedRoles }: ProtectedRouteProps) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

// ---------------------------------------------------------------------------
// Placeholder page for routes not yet fully built
// ---------------------------------------------------------------------------

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-96 flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="text-sm text-slate-500">
        This page is under development.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root Redirect
// ---------------------------------------------------------------------------

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const roleRoutes: Record<UserRole, string> = {
    patient: '/patient/dashboard',
    doctor: '/doctor/dashboard',
    hospital_admin: '/hospital/dashboard',
    analyst: '/analyst/dashboard',
  };

  return <Navigate to={user ? roleRoutes[user.role] : '/login'} replace />;
}

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------

export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Patient routes */}
      <Route
        path="/patient/dashboard"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <PatientDashboard />
          </DashboardRoute>
        }
      />
      <Route
        path="/patient/triage"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <SymptomTriage />
          </DashboardRoute>
        }
      />
      <Route
        path="/patient/appointments"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <PlaceholderPage title="Appointments" />
          </DashboardRoute>
        }
      />
      <Route
        path="/patient/telemetry"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <PlaceholderPage title="Telemetry" />
          </DashboardRoute>
        }
      />
      <Route
        path="/patient/records"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <PlaceholderPage title="Medical Records" />
          </DashboardRoute>
        }
      />
      <Route
        path="/patient/devices"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <PlaceholderPage title="Wearable Devices" />
          </DashboardRoute>
        }
      />
      <Route
        path="/patient/*"
        element={
          <DashboardRoute allowedRoles={['patient']}>
            <Navigate to="/patient/dashboard" replace />
          </DashboardRoute>
        }
      />

      {/* Doctor routes */}
      <Route
        path="/doctor/dashboard"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <DoctorDashboard />
          </DashboardRoute>
        }
      />
      <Route
        path="/doctor/patients"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <PlaceholderPage title="Patient List" />
          </DashboardRoute>
        }
      />
      <Route
        path="/doctor/schedule"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <PlaceholderPage title="Schedule" />
          </DashboardRoute>
        }
      />
      <Route
        path="/doctor/efficacy"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <EfficacyTracker />
          </DashboardRoute>
        }
      />
      <Route
        path="/doctor/triage-review"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <PlaceholderPage title="Triage Review" />
          </DashboardRoute>
        }
      />
      <Route
        path="/doctor/telemetry"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <PlaceholderPage title="Patient Telemetry" />
          </DashboardRoute>
        }
      />
      <Route
        path="/doctor/*"
        element={
          <DashboardRoute allowedRoles={['doctor']}>
            <Navigate to="/doctor/dashboard" replace />
          </DashboardRoute>
        }
      />

      {/* Hospital routes */}
      <Route
        path="/hospital/dashboard"
        element={
          <DashboardRoute allowedRoles={['hospital_admin']}>
            <HospitalDashboard />
          </DashboardRoute>
        }
      />
      <Route
        path="/hospital/departments"
        element={
          <DashboardRoute allowedRoles={['hospital_admin']}>
            <PlaceholderPage title="Departments" />
          </DashboardRoute>
        }
      />
      <Route
        path="/hospital/staff"
        element={
          <DashboardRoute allowedRoles={['hospital_admin']}>
            <PlaceholderPage title="Staff Management" />
          </DashboardRoute>
        }
      />
      <Route
        path="/hospital/resources"
        element={
          <DashboardRoute allowedRoles={['hospital_admin']}>
            <PlaceholderPage title="Resources" />
          </DashboardRoute>
        }
      />
      <Route
        path="/hospital/reports"
        element={
          <DashboardRoute allowedRoles={['hospital_admin']}>
            <PlaceholderPage title="Reports" />
          </DashboardRoute>
        }
      />
      <Route
        path="/hospital/*"
        element={
          <DashboardRoute allowedRoles={['hospital_admin']}>
            <Navigate to="/hospital/dashboard" replace />
          </DashboardRoute>
        }
      />

      {/* Analyst routes */}
      <Route
        path="/analyst/dashboard"
        element={
          <DashboardRoute allowedRoles={['analyst']}>
            <AnalystDashboard />
          </DashboardRoute>
        }
      />
      <Route
        path="/analyst/surveillance"
        element={
          <DashboardRoute allowedRoles={['analyst']}>
            <PlaceholderPage title="Disease Surveillance Map" />
          </DashboardRoute>
        }
      />
      <Route
        path="/analyst/outbreaks"
        element={
          <DashboardRoute allowedRoles={['analyst']}>
            <PlaceholderPage title="Outbreak Management" />
          </DashboardRoute>
        }
      />
      <Route
        path="/analyst/supply-chain"
        element={
          <DashboardRoute allowedRoles={['analyst']}>
            <SupplyChainPage />
          </DashboardRoute>
        }
      />
      <Route
        path="/analyst/reports"
        element={
          <DashboardRoute allowedRoles={['analyst']}>
            <PlaceholderPage title="Reports" />
          </DashboardRoute>
        }
      />
      <Route
        path="/analyst/*"
        element={
          <DashboardRoute allowedRoles={['analyst']}>
            <Navigate to="/analyst/dashboard" replace />
          </DashboardRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
