import { useState, useMemo } from 'react';
import { ClipboardCheck, Check, Edit, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { usePatients } from '@/hooks/usePatients';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlatTriageReview {
  id: string;
  patientId: string;
  patientName: string;
  symptoms: string[];
  symptomDescription: string;
  urgency: 'low' | 'moderate' | 'high' | 'critical' | 'emergency';
  confidenceScore: number;
  recommendedSpecializations: string[];
  createdAt: string;
}

function mapUrgency(level: string): FlatTriageReview['urgency'] {
  switch (level) {
    case 'EMERGENCY': return 'emergency';
    case 'URGENT': return 'high';
    case 'SEMI_URGENT': return 'moderate';
    case 'NON_URGENT': return 'low';
    default: return 'low';
  }
}

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
  review: FlatTriageReview | null;
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
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Symptoms</p>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {review.symptomDescription}
          </p>
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
  onApprove,
  onOverride,
}: {
  review: FlatTriageReview;
  onApprove: () => void;
  onOverride: (review: FlatTriageReview) => void;
}) {
  return (
    <Card className={cn(
      review.urgency === 'emergency' && 'border-red-200 dark:border-red-900',
      review.urgency === 'critical' && 'border-orange-200 dark:border-orange-900',
    )}>
      <CardContent className="p-5">
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
                {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <UrgencyBadge level={review.urgency} />
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Symptoms</p>
          <div className="flex flex-wrap gap-1">
            {review.symptoms.map((s) => (
              <Badge key={s} variant="default" size="sm">{s}</Badge>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">AI Assessment</p>
            <Badge variant="info" size="sm">
              {Math.round(review.confidenceScore * 100)}% confidence
            </Badge>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {review.symptomDescription}
          </p>
          {review.recommendedSpecializations.length > 0 && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Recommended: <strong className="text-slate-700 dark:text-slate-300">{review.recommendedSpecializations.join(', ')}</strong>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <Button variant="primary" size="sm" onClick={onApprove}>
            <Check className="h-4 w-4" />
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOverride(review)}>
            <Edit className="h-4 w-4" />
            Override
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
  const user = useAuthStore((s) => s.user);
  const doctorId = user?.id ?? '';
  const { patients, isLoading } = usePatients(doctorId);
  const [overrideReview, setOverrideReview] = useState<FlatTriageReview | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Flatten all triage events from all patients
  const triageReviews: FlatTriageReview[] = useMemo(() => {
    const reviews: FlatTriageReview[] = [];
    for (const patient of patients) {
      for (const triage of (patient.triageHistory ?? [])) {
        reviews.push({
          id: triage.id,
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          symptoms: triage.symptoms,
          symptomDescription: triage.symptoms.join(', '),
          urgency: mapUrgency(triage.urgencyLevel),
          confidenceScore: triage.confidenceScore,
          recommendedSpecializations: [],
          createdAt: triage.createdAt,
        });
      }
    }
    // Sort by creation date (newest first)
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reviews;
  }, [patients]);

  const pendingReviews = triageReviews.filter(r => !approvedIds.has(r.id));

  const handleApprove = (id: string) => {
    setApprovedIds(prev => new Set([...prev, id]));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Triage Review</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review and approve AI-assisted triage assessments
          </p>
        </div>
        <Badge variant="warning" size="lg" dot>
          {pendingReviews.length} Pending Reviews
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Emergency', count: pendingReviews.filter((r) => r.urgency === 'emergency').length, color: 'text-purple-500' },
          { label: 'High', count: pendingReviews.filter((r) => r.urgency === 'high').length, color: 'text-red-500' },
          { label: 'Moderate', count: pendingReviews.filter((r) => r.urgency === 'moderate').length, color: 'text-orange-500' },
          { label: 'Low', count: pendingReviews.filter((r) => r.urgency === 'low').length, color: 'text-slate-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <p className={cn('text-2xl font-bold', stat.color)}>{stat.count}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingReviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <ClipboardCheck className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">All Caught Up</h3>
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
              onApprove={() => handleApprove(review.id)}
              onOverride={setOverrideReview}
            />
          ))}
        </div>
      )}

      <OverrideModal
        open={overrideReview !== null}
        onClose={() => setOverrideReview(null)}
        review={overrideReview}
      />
    </div>
  );
}
