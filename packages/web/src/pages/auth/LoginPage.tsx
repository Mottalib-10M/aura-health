import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Fingerprint, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    login(email, password);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <span className="font-display text-2xl font-bold text-white">
              Aura Health
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight text-white text-balance">
            AI-Powered Healthcare for Central Asia
          </h1>
          <p className="max-w-md text-lg text-primary-100">
            Intelligent triage, real-time telemetry monitoring, and
            epidemiological surveillance -- all in one platform.
          </p>
          <div className="flex gap-6 text-sm text-primary-200">
            <div>
              <p className="text-2xl font-bold text-white">2M+</p>
              <p>Patients Served</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">500+</p>
              <p>Healthcare Facilities</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">99.7%</p>
              <p>Triage Accuracy</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-primary-300">
          &copy; {new Date().getFullYear()} Aura Health. All rights reserved.
        </p>
      </div>

      {/* Right panel - login form */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <span className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Aura Health
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              startIcon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              startIcon={<Lock className="h-4 w-4" />}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  Remember me
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isLoading}
            >
              Sign In
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>

          {/* Biometric login */}
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => {
                /* Biometric auth integration */
              }}
            >
              <Fingerprint className="h-5 w-5" aria-hidden="true" />
              Sign in with Biometrics
            </Button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">or continue with</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Social / SSO buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button">
              Government SSO
            </Button>
            <Button variant="outline" type="button">
              Hospital ID
            </Button>
          </div>

          {/* Register link */}
          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className={cn(
                'font-semibold text-primary-600 hover:text-primary-700',
                'dark:text-primary-400 dark:hover:text-primary-300',
              )}
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
