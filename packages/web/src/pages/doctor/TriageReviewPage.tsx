import { useState } from 'react';
import { ClipboardCheck, AlertTriangle, MessageSquare, Check, Edit, Info, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface TriageReview {
  id: string;
  patientName: string;
  patientAge: number;
  submittedAt: string;
  urgency: 'low' | 'moderate' | 'high' | 'critical' | 'emergency';
  symptoms: string[];
  aiRecommendation: string;
  aiConfidence: number;
  suggestedSpecialty: string;
  suggestedAction: string;
  status: 'pending' | 'approved' | 'overridden';
}

const mockReviews: TriageReview[] = [
  {
    id: '1',
    patientName: 'Bobur Tursunov',
    patientAge: 55,
    submittedAt: '2026-05-14T08:30:00Z',
    urgency: 'emergency',
    symptoms: ['Chest pain', 'Shortness of breath', 'Diaphoresis', 'Left arm numbness'],
    aiRecommendation: 'Immediate cardiac evaluation recommended. Pattern consistent with acute coronary syndrome. ECG and troponin levels should be obtained urgently.',
    aiConfidence: 0.94,
    suggestedSpecialty: 'Cardiology / Emergency',
    suggestedAction: 'Immediate referral to emergency department',
    status: 'pending',
  },
  {
    id: '2',
    patientName: 'Javlon Yusupov',
    patientAge: 67,
    submittedAt: '2026-05-14T09:15:00Z',
    urgency: 'high',
    symptoms: ['Worsening dyspnea', 'Peripheral edema', 'Fatigue', 'Weight gain (3kg/week)'],
    aiRecommendation: 'Signs of decompensated heart failure. Recommend urgent evaluation, BNP levels, chest X-ray, and medication review. Current diuretic dosage may need adjustment.',
    aiConfidence: 0.88,
    suggestedSpecialty: 'Cardiology',
    suggestedAction: 'Urgent appointment within 24 hours',
    status: 'pending',
  },
  {
    id: '3',
    patientName: 'Malika Karimova',
    patientAge: 32,
    submittedAt: '2026-05-14T10:00:00Z',
    urgency: 'moderate',
    symptoms: ['Wheezing', 'Increased rescue inhaler use', 'Nocturnal cough'],
    aiRecommendation: 'Asthma exacerbation likely. Step-up therapy may be needed. Consider spirometry to assess current lung function. Review inhaler technique.',
    aiConfidence: 0.91,
    suggestedSpecialty: 'Pulmonology',
    suggestedAction: 'Schedule appointment within 3-5 days',
    status: 'pending',
  },
  {
    id: '4',
    patientName: 'Dilnoza Abdullaeva',
    patientAge: 28,
    submittedAt: '2026-05-14T10:30:00Z',
    urgency: 'low',
    symptoms: ['Runny nose', 'Sneezing', 'Itchy eyes'],
    aiRecommendation: 'Seasonal allergic rhinitis. OTC antihistamines should be sufficient. Follow up only if symptoms persist beyond 2 weeks or worsen.',
    aiConfidence: 0.96,
    suggestedSpecialty: 'General Practice',
    suggestedAction: 'Self-care with pharmacy consultation',
    status: 'pending',
  },
  {
    id: '5',
    patientName: 'Sardor Nishanov',
    patientAge: 73,
    submittedAt: '2026-05-13T16:00:00Z',
    urgency: 'critical',
    symptoms: ['Elevated creatinine', 'Reduced urine output', 'Nausea', 'Confusion'],
    aiRecommendation: 'Acute kidney injury suspected. Urgent nephrology consultation recommended. Hold nephrotoxic medications. Monitor fluid balance closely.',
    aiConfidence: 0.87,
    suggestedSpecialty: 'Nephrology',
    suggestedAction: 'Urgent referral within 12 hours',
    status: 'pending',
  },
];

// ---------------------------------------------------------------------------
// Override Modal
// ---------------------------------------------------------------------------

function OverrideModal({
  open,
  onClose,
  review,
}: {
  open: boolean;
  onClose: () => void;
  review: TriageReview | null;
}) {
  const [notes, setNotes] = useState('');
  const [newUrgency, setNewUrgency] = useState('');

  if (!review) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Override Triage Decision"
      description={`Overriding AI triage for ${review.patientName}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!notes.trim()} onClick={onClose}>
            Submit Override
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            AI Assessment
          </p>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {review.aiRecommendation}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Updated Urgency Level
          </label>
          <div className="flex gap-2">
            {(['low', 'moderate', 'high', 'critical', 'emergency'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setNewUrgency(level)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  newUrgency === level
                    ? 'bg-primary-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Doctor&apos;s Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Explain the reason for overriding the AI triage assessment..."
            className={cn(
              'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
              'text-slate-900 placeholder:text-slate-400',
              'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
              'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
            )}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Triage Review Card
// ---------------------------------------------------------------------------

function TriageReviewCard({
  review,
  onOverride,
}: {
  review: TriageReview;
  onOverride: (review: TriageReview) => void;
}) {
  return (
    <Card className={cn(
      review.urgency === 'emergency' && 'border-red-200 dark:border-red-900',
      review.urgency === 'critical' && 'border-orange-200 dark:border-orange-900',
    )}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {review.patientName.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {review.patientName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {review.patientAge} years old | Submitted {new Date(review.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <UrgencyBadge level={review.urgency} />
        </div>

        {/* Symptoms */}
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Symptoms</p>
          <div className="flex flex-wrap gap-1">
            {review.symptoms.map((s) => (
              <Badge key={s} variant="default" size="sm">{s}</Badge>
            ))}
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              AI Recommendation
            </p>
            <Badge variant="info" size="sm">
              {Math.round(review.aiConfidence * 100)}% confidence
            </Badge>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {review.aiRecommendation}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Specialty: <strong className="text-slate-700 dark:text-slate-300">{review.suggestedSpecialty}</strong></span>
            <span>Action: <strong className="text-slate-700 dark:text-slate-300">{review.suggestedAction}</strong></span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <Button variant="primary" size="sm">
            <Check className="h-4 w-4" />
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOverride(review)}>
            <Edit className="h-4 w-4" />
            Override
          </Button>
          <Button variant="ghost" size="sm">
            <Info className="h-4 w-4" />
            Request More Info
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function TriageReviewPage() {
  const [isLoading] = useState(false);
  const [overrideReview, setOverrideReview] = useState<TriageReview | null>(null);

  const pendingReviews = mockReviews.filter((r) => r.status === 'pending');

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
            Triage Review
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review and approve AI-assisted triage assessments
          </p>
        </div>
        <Badge variant="warning" size="lg" dot>
          {pendingReviews.length} Pending Reviews
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Emergency', count: pendingReviews.filter((r) => r.urgency === 'emergency').length, color: 'text-purple-500' },
          { label: 'Critical', count: pendingReviews.filter((r) => r.urgency === 'critical').length, color: 'text-red-500' },
          { label: 'High', count: pendingReviews.filter((r) => r.urgency === 'high').length, color: 'text-orange-500' },
          { label: 'Other', count: pendingReviews.filter((r) => !['emergency', 'critical', 'high'].includes(r.urgency)).length, color: 'text-slate-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <p className={cn('text-2xl font-bold', stat.color)}>{stat.count}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review List */}
      {pendingReviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <ClipboardCheck className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
              All Caught Up
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No pending triage reviews at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingReviews.map((review) => (
            <TriageReviewCard
              key={review.id}
              review={review}
              onOverride={setOverrideReview}
            />
          ))}
        </div>
      )}

      {/* Override Modal */}
      <OverrideModal
        open={overrideReview !== null}
        onClose={() => setOverrideReview(null)}
        review={overrideReview}
      />
    </div>
  );
}
