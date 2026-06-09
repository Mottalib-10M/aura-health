import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Stethoscope,
  Mail,
  Lock,
  Phone,
  Fingerprint,
  Upload,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegistrationStep = 'role' | 'personal' | 'verification' | 'complete';

interface FormData {
  role: UserRole | '';
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  preferredLanguage: string;
  // Doctor-specific
  specialization: string;
  licenseNumber: string;
  institutionId: string;
}

const steps: { key: RegistrationStep; label: string }[] = [
  { key: 'role', label: 'Role' },
  { key: 'personal', label: 'Personal Info' },
  { key: 'verification', label: 'Verification' },
  { key: 'complete', label: 'Complete' },
];

const languageOptions = [
  { value: 'uz', label: "O'zbek (Uzbek)" },
  { value: 'ky', label: 'Кыргызча (Kyrgyz)' },
  { value: 'tg', label: 'Тоҷикӣ (Tajik)' },
  { value: 'ru', label: 'Русский (Russian)' },
  { value: 'en', label: 'English' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterPage() {
  const { register, isLoading, error } = useAuth();
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('role');
  const [formData, setFormData] = useState<FormData>({
    role: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    preferredLanguage: 'en',
    specialization: '',
    licenseNumber: '',
    institutionId: '',
  });

  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  function update(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function goNext() {
    const idx = steps.findIndex((s) => s.key === currentStep);
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].key);
  }

  function goBack() {
    const idx = steps.findIndex((s) => s.key === currentStep);
    if (idx > 0) setCurrentStep(steps[idx - 1].key);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (currentStep === 'verification') {
      register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role as UserRole,
        preferredLanguage: formData.preferredLanguage,
      });
      setCurrentStep('complete');
    } else {
      goNext();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-surface-dark">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-sm font-bold text-white">U</span>
          </div>
          <span className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Uzavita
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between">
            {steps.map((step, idx) => (
              <div
                key={step.key}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium',
                  idx <= currentIndex
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-slate-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold',
                    idx < currentIndex
                      ? 'bg-primary-600 text-white'
                      : idx === currentIndex
                        ? 'border-2 border-primary-600 text-primary-600'
                        : 'border-2 border-slate-300 text-slate-400 dark:border-slate-600',
                  )}
                >
                  {idx < currentIndex ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Registration progress"
            />
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-800 md:p-8">
          {error && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Step 1: Role Selection */}
            {currentStep === 'role' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Choose your role
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select how you will use Uzavita
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Patient card */}
                  <button
                    type="button"
                    onClick={() => {
                      update('role', 'patient');
                      goNext();
                    }}
                    className={cn(
                      'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all',
                      'hover:border-primary-500 hover:shadow-glow-primary',
                      formData.role === 'patient'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                        : 'border-slate-200 dark:border-slate-600',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    )}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900">
                      <User className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Patient
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Track health, triage symptoms, and book appointments
                      </p>
                    </div>
                  </button>

                  {/* Doctor card */}
                  <button
                    type="button"
                    onClick={() => {
                      update('role', 'doctor');
                      goNext();
                    }}
                    className={cn(
                      'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all',
                      'hover:border-primary-500 hover:shadow-glow-primary',
                      formData.role === 'doctor'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                        : 'border-slate-200 dark:border-slate-600',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    )}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-100 dark:bg-secondary-900">
                      <Stethoscope className="h-7 w-7 text-secondary-600 dark:text-secondary-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Doctor
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Manage patients, review AI triage, and track efficacy
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Personal Info */}
            {currentStep === 'personal' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Personal Information
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Fill in your details to create your account
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First Name"
                    value={formData.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    required
                    placeholder="Enter first name"
                  />
                  <Input
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    required
                    placeholder="Enter last name"
                  />
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                  placeholder="name@example.com"
                  startIcon={<Mail className="h-4 w-4" />}
                  autoComplete="email"
                />

                <Input
                  label="Phone Number"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+998 XX XXX XX XX"
                  startIcon={<Phone className="h-4 w-4" />}
                />

                <Input
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  placeholder="Create a strong password"
                  startIcon={<Lock className="h-4 w-4" />}
                  helperText="Minimum 8 characters with uppercase, lowercase, and a number"
                  autoComplete="new-password"
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  required
                  placeholder="Re-enter your password"
                  startIcon={<Lock className="h-4 w-4" />}
                  error={
                    formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                  autoComplete="new-password"
                />

                <Select
                  label="Preferred Language"
                  value={formData.preferredLanguage}
                  onChange={(e) => update('preferredLanguage', e.target.value)}
                  options={languageOptions}
                />

                {/* Doctor-specific fields */}
                {formData.role === 'doctor' && (
                  <div className="mt-4 space-y-4 rounded-lg border border-secondary-200 bg-secondary-50 p-4 dark:border-secondary-800 dark:bg-secondary-950">
                    <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">
                      Professional Details
                    </p>
                    <Input
                      label="Medical License Number"
                      value={formData.licenseNumber}
                      onChange={(e) => update('licenseNumber', e.target.value)}
                      required
                      placeholder="Enter license number"
                    />
                    <Input
                      label="Primary Specialization"
                      value={formData.specialization}
                      onChange={(e) => update('specialization', e.target.value)}
                      required
                      placeholder="e.g., Cardiology, General Practice"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" className="flex-1">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Verification */}
            {currentStep === 'verification' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {formData.role === 'doctor'
                      ? 'Credential Verification'
                      : 'Biometric Setup'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formData.role === 'doctor'
                      ? 'Upload your medical credentials for verification'
                      : 'Optionally set up biometric authentication for faster sign-in'}
                  </p>
                </div>

                {formData.role === 'doctor' ? (
                  <div className="space-y-4">
                    {/* File upload area */}
                    <div
                      className={cn(
                        'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8',
                        'border-slate-300 dark:border-slate-600',
                        'hover:border-primary-400 dark:hover:border-primary-600',
                        'transition-colors cursor-pointer',
                      )}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload medical credentials"
                    >
                      <Upload className="h-10 w-10 text-slate-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Upload Medical License
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          PDF, JPG, or PNG up to 10MB
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8',
                        'border-slate-300 dark:border-slate-600',
                        'hover:border-primary-400 dark:hover:border-primary-600',
                        'transition-colors cursor-pointer',
                      )}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload government ID"
                    >
                      <Upload className="h-10 w-10 text-slate-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Upload Government ID
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          For identity verification
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-4 rounded-xl border-2 border-slate-200 p-5',
                        'hover:border-primary-500 hover:shadow-glow-primary transition-all',
                        'dark:border-slate-600',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900">
                        <Fingerprint className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-slate-900 dark:text-white">
                          Set Up Biometric Login
                        </p>
                        <p className="text-xs text-slate-500">
                          Use fingerprint or face recognition for quick sign-in
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      className="w-full text-center text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      Skip for now
                    </button>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" loading={isLoading}>
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 'complete' && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Account Created!
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {formData.role === 'doctor'
                      ? 'Your credentials are being verified. You will be notified once approved.'
                      : 'Your account is ready. Start by connecting your wearable device or checking symptoms.'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    window.location.href =
                      formData.role === 'doctor'
                        ? '/doctor/dashboard'
                        : '/patient/dashboard';
                  }}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </form>
        </div>

        {/* Login link */}
        {currentStep !== 'complete' && (
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
