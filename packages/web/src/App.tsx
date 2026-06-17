import { type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';

// Auth pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';

// Patient pages
import { PatientDashboard } from '@/pages/patient/PatientDashboard';
import { SymptomTriage } from '@/pages/patient/SymptomTriage';
import { AppointmentsPage } from '@/pages/patient/AppointmentsPage';
import { TelemetryPage } from '@/pages/patient/TelemetryPage';
import { RecordsPage } from '@/pages/patient/RecordsPage';
import { DevicesPage } from '@/pages/patient/DevicesPage';
import { ProfilePage } from '@/pages/patient/ProfilePage';

// Doctor pages
import { DoctorDashboard } from '@/pages/doctor/DoctorDashboard';
import { EfficacyTracker } from '@/pages/doctor/EfficacyTracker';
import { PatientsPage } from '@/pages/doctor/PatientsPage';
import { SchedulePage } from '@/pages/doctor/SchedulePage';
import { TriageReviewPage } from '@/pages/doctor/TriageReviewPage';
import { PatientTelemetryPage } from '@/pages/doctor/PatientTelemetryPage';

// Hospital pages
import { HospitalDashboard } from '@/pages/hospital/HospitalDashboard';
import { DepartmentsPage } from '@/pages/hospital/DepartmentsPage';
import { StaffPage } from '@/pages/hospital/StaffPage';
import { ResourcesPage } from '@/pages/hospital/ResourcesPage';
import { ReportsPage as HospitalReportsPage } from '@/pages/hospital/ReportsPage';

// Analyst pages
import { AnalystDashboard } from '@/pages/analyst/AnalystDashboard';
import { SupplyChainPage } from '@/pages/analyst/SupplyChainPage';
import { SurveillancePage } from '@/pages/analyst/SurveillancePage';
import { OutbreaksPage } from '@/pages/analyst/OutbreaksPage';
import { AnalystReportsPage } from '@/pages/analyst/ReportsPage';

// Public pages
import { AboutPage } from '@/pages/AboutPage';
import { LegalPage } from '@/pages/LegalPage';

// Error pages
import { NotFoundPage } from '@/pages/NotFoundPage';

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
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/legal" element={<LegalPage />} />

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
              <AppointmentsPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/patient/telemetry"
          element={
            <DashboardRoute allowedRoles={['patient']}>
              <TelemetryPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/patient/records"
          element={
            <DashboardRoute allowedRoles={['patient']}>
              <RecordsPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/patient/devices"
          element={
            <DashboardRoute allowedRoles={['patient']}>
              <DevicesPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <DashboardRoute allowedRoles={['patient']}>
              <ProfilePage />
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
              <PatientsPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/doctor/schedule"
          element={
            <DashboardRoute allowedRoles={['doctor']}>
              <SchedulePage />
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
              <TriageReviewPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/doctor/telemetry"
          element={
            <DashboardRoute allowedRoles={['doctor']}>
              <PatientTelemetryPage />
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
              <DepartmentsPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/hospital/staff"
          element={
            <DashboardRoute allowedRoles={['hospital_admin']}>
              <StaffPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/hospital/resources"
          element={
            <DashboardRoute allowedRoles={['hospital_admin']}>
              <ResourcesPage />
            </DashboardRoute>
          }
        />
        <Route
          path="/hospital/reports"
          element={
            <DashboardRoute allowedRoles={['hospital_admin']}>
              <HospitalReportsPage />
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
              <SurveillancePage />
            </DashboardRoute>
          }
        />
        <Route
          path="/analyst/outbreaks"
          element={
            <DashboardRoute allowedRoles={['analyst']}>
              <OutbreaksPage />
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
              <AnalystReportsPage />
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

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Global Toast Notifications */}
      <ToastProvider />
    </ErrorBoundary>
  );
}
