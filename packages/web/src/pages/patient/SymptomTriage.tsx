import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  Shield,
  Stethoscope,
  RotateCcw,
  Heart,
  Activity,
  Thermometer,
  FlaskConical,
  Watch,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { UrgencyBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useTriage } from '@/hooks/useTriage';
import { formatConfidence, formatDuration } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Step animation variants
// ---------------------------------------------------------------------------

const stepVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -30, transition: { duration: 0.2 } },
};

// ---------------------------------------------------------------------------
// Severity labels
// ---------------------------------------------------------------------------

const severityLabels = ['', 'Minimal', 'Mild', 'Moderate', 'Severe', 'Worst'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SymptomTriage() {
  const triage = useTriage();

  // Auto-advance from analyzing step when results arrive
  useEffect(() => {
    if (triage.currentStep === 'analyzing' && triage.result) {
      triage.setStep('results');
    }
  }, [triage]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/patient/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            AI Symptom Triage
          </h1>
          <p className="text-sm text-slate-500">
            Describe your symptoms to receive AI-powered specialist recommendations
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-full rounded-full bg-primary-600"
            animate={{ width: `${triage.progress}%` }}
            transition={{ duration: 0.5 }}
            role="progressbar"
            aria-valuenow={triage.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Triage progress"
          />
        </div>
        <div className="mt-1 flex justify-between text-2xs text-slate-400">
          <span>Symptoms</span>
          <span>Clarification</span>
          <span>Vitals</span>
          <span>Analysis</span>
          <span>Results</span>
        </div>
      </div>

      {/* Error banner */}
      {triage.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" role="alert">
          {triage.error}
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        {/* ============ Step 1: Symptoms ============ */}
        {triage.currentStep === 'symptoms' && (
          <motion.div
            key="symptoms"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Card>
              <CardContent className="space-y-6 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    What symptoms are you experiencing?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Describe your symptoms in your own words. Be as specific as possible.
                  </p>
                </div>

                <div className="relative">
                  <textarea
                    value={triage.input.symptomDescription}
                    onChange={(e) => triage.setSymptomDescription(e.target.value)}
                    placeholder="e.g., I have been having sharp chest pains for the last 2 days, especially when breathing deeply. I also feel short of breath when climbing stairs..."
                    className={cn(
                      'w-full rounded-lg border border-slate-300 bg-white p-4 pr-12 text-sm',
                      'min-h-[120px] resize-y',
                      'placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                      'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
                    )}
                    aria-label="Symptom description"
                  />
                  <button
                    type="button"
                    className={cn(
                      'absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors',
                      'hover:bg-slate-100 hover:text-primary-600',
                      'dark:hover:bg-slate-700',
                    )}
                    aria-label="Voice input"
                    title="Speak your symptoms"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Duration (hours)"
                    type="number"
                    min={0}
                    value={triage.input.symptomDurationHours || ''}
                    onChange={(e) => triage.setSymptomDuration(Number(e.target.value))}
                    placeholder="How long have you had these symptoms?"
                  />
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Severity (1-5)
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      {([1, 2, 3, 4, 5] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => triage.setSeverityScale(level)}
                          className={cn(
                            'flex h-10 w-full items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                            triage.input.severityScale === level
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400',
                          )}
                          aria-label={`Severity ${level}: ${severityLabels[level]}`}
                          aria-pressed={triage.input.severityScale === level}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-center text-2xs text-slate-400">
                      {severityLabels[triage.input.severityScale]}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={triage.submitSymptoms}
                    loading={triage.isProcessing}
                    disabled={!triage.input.symptomDescription.trim()}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ============ Step 2: Clarifying Questions ============ */}
        {triage.currentStep === 'clarifying' && (
          <motion.div
            key="clarifying"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Card>
              <CardContent className="space-y-6 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    A few more questions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Help us better understand your symptoms
                  </p>
                </div>

                <div className="space-y-4">
                  {triage.clarifyingQuestions.map((q) => (
                    <div key={q.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                      <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">
                        {q.question}
                      </p>

                      {q.type === 'yes_no' && (
                        <div className="flex gap-2">
                          {['Yes', 'No'].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => triage.setClarifyingAnswer(q.id, opt.toLowerCase())}
                              className={cn(
                                'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                                triage.input.clarifyingAnswers[q.id] === opt.toLowerCase()
                                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400',
                              )}
                              aria-pressed={triage.input.clarifyingAnswers[q.id] === opt.toLowerCase()}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === 'scale' && (
                        <div className="flex gap-2">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => triage.setClarifyingAnswer(q.id, String(val))}
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors',
                                triage.input.clarifyingAnswers[q.id] === String(val)
                                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                              )}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === 'text' && (
                        <Input
                          value={triage.input.clarifyingAnswers[q.id] ?? ''}
                          onChange={(e) => triage.setClarifyingAnswer(q.id, e.target.value)}
                          placeholder="Type your answer..."
                        />
                      )}

                      {q.type === 'multi_select' && q.options && (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt) => {
                            const selected = (triage.input.clarifyingAnswers[q.id] ?? '').split(',').includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const current = (triage.input.clarifyingAnswers[q.id] ?? '').split(',').filter(Boolean);
                                  const next = selected
                                    ? current.filter((v) => v !== opt)
                                    : [...current, opt];
                                  triage.setClarifyingAnswer(q.id, next.join(','));
                                }}
                                className={cn(
                                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                                  selected
                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                                )}
                                aria-pressed={selected}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={triage.prevStep}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={triage.nextStep}>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ============ Step 3: Vital Signs ============ */}
        {triage.currentStep === 'vitals' && (
          <motion.div
            key="vitals"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Card>
              <CardContent className="space-y-6 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Vital Signs (Optional)
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Providing vital signs improves triage accuracy
                  </p>
                </div>

                {/* Wearable sync option */}
                <button
                  type="button"
                  onClick={() => triage.setUseWearableData(!triage.input.useWearableData)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border-2 p-4 transition-all',
                    triage.input.useWearableData
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                      : 'border-slate-200 hover:border-primary-300 dark:border-slate-600',
                  )}
                  aria-pressed={triage.input.useWearableData}
                >
                  <Watch className={cn('h-6 w-6', triage.input.useWearableData ? 'text-primary-600' : 'text-slate-400')} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Sync from Wearable Device
                    </p>
                    <p className="text-xs text-slate-500">
                      Automatically pull latest vitals from your connected device
                    </p>
                  </div>
                </button>

                {/* Manual input */}
                {!triage.input.useWearableData && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Heart Rate (bpm)"
                      type="number"
                      placeholder="e.g., 75"
                      startIcon={<Heart className="h-4 w-4" />}
                      onChange={(e) => triage.setVitalSigns({ heart_rate_bpm: Number(e.target.value) || undefined })}
                    />
                    <Input
                      label="SpO2 (%)"
                      type="number"
                      placeholder="e.g., 98"
                      startIcon={<Activity className="h-4 w-4" />}
                      onChange={(e) => triage.setVitalSigns({ spO2_percent: Number(e.target.value) || undefined })}
                    />
                    <Input
                      label="Temperature (\u00B0C)"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 37.2"
                      startIcon={<Thermometer className="h-4 w-4" />}
                      onChange={(e) => triage.setVitalSigns({ temperature_celsius: Number(e.target.value) || undefined })}
                    />
                    <Input
                      label="Respiratory Rate"
                      type="number"
                      placeholder="e.g., 16"
                      startIcon={<Activity className="h-4 w-4" />}
                      onChange={(e) => triage.setVitalSigns({ respiratory_rate: Number(e.target.value) || undefined })}
                    />
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={triage.prevStep}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={triage.submitForAnalysis}>
                    Analyze Symptoms
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ============ Step 4: Analyzing ============ */}
        {triage.currentStep === 'analyzing' && (
          <motion.div
            key="analyzing"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Card>
              <CardContent className="flex flex-col items-center p-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="mb-6"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                    <FlaskConical className="h-10 w-10 text-primary-600 dark:text-primary-400" />
                  </div>
                </motion.div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  AI Analysis in Progress
                </h2>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Our AI is analyzing your symptoms, medical history, and vital signs to
                  determine the best specialist recommendations.
                </p>
                <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
                  <Spinner size="sm" />
                  <span>This typically takes 3-5 seconds...</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ============ Step 5: Results ============ */}
        {triage.currentStep === 'results' && triage.result && (
          <motion.div
            key="results"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-4"
          >
            {/* Urgency badge */}
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-slate-500">Triage Assessment</p>
                  <div className="mt-1">
                    <UrgencyBadge level={triage.result.urgencyLevel} size="lg" />
                  </div>
                </div>
                <Shield className={cn(
                  'h-10 w-10',
                  triage.result.urgencyLevel === 'emergency' || triage.result.urgencyLevel === 'critical'
                    ? 'text-red-500'
                    : triage.result.urgencyLevel === 'high'
                      ? 'text-orange-500'
                      : 'text-green-500',
                )} />
              </CardContent>
            </Card>

            {/* Red flags */}
            {triage.result.redFlags.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950" role="alert">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">Red Flags Detected</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {triage.result.redFlags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specialist recommendations */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Recommended Specialists
              </h3>
              <div className="space-y-3">
                {triage.result.recommendedSpecializations.map((spec, idx) => (
                  <Card key={idx} hoverable>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900">
                          <Stethoscope className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {spec.specialty}
                          </p>
                          <p className="text-xs text-slate-500">
                            Confidence: {formatConfidence(spec.confidenceScore)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {spec.rationale}
                          </p>
                          <p className="text-xs text-slate-400">
                            Est. wait: {formatDuration(spec.estimatedWaitTimeMinutes)}
                          </p>
                        </div>
                      </div>
                      <Link to="/patient/appointments">
                        <Button size="sm">
                          <CalendarDays className="h-4 w-4" />
                          Book
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Suggested diagnostics */}
            {triage.result.suggestedDiagnostics.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                    Suggested Diagnostic Tests
                  </h3>
                  <ul className="space-y-1">
                    {triage.result.suggestedDiagnostics.map((test, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
                        {test}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={triage.resetTriage}>
                <RotateCcw className="h-4 w-4" />
                New Triage
              </Button>
              <Link to="/patient/dashboard" className="flex-1">
                <Button className="w-full">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
