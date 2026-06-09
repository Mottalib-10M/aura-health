import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
            <span className="text-lg font-bold text-white">U</span>
          </div>
          <span className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Uzavita
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {isSubmitted ? (
            /* Success State */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                Check Your Email
              </h1>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                We&apos;ve sent a password reset link to{' '}
                <strong className="text-slate-700 dark:text-slate-300">{email}</strong>.
                Please check your inbox and follow the instructions.
              </p>
              <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">
                Didn&apos;t receive the email? Check your spam folder or try again.
              </p>
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full" onClick={() => setIsSubmitted(false)}>
                  Try Again
                </Button>
                <Link to="/login">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* Form State */
            <>
              <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                Forgot Password?
              </h1>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Enter your email address or phone number and we&apos;ll send you a link to reset
                your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email or Phone Number"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com or +998 90 123 4567"
                  required
                  startIcon={<Mail className="h-4 w-4" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={isSubmitting}
                  disabled={!email.trim()}
                >
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
