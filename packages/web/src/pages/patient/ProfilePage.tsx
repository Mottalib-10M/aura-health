import { useState } from 'react';
import { User, Lock, Shield, Bell, Watch, Globe, Trash2, Save, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('+998 90 123 4567');
  const [dateOfBirth, setDateOfBirth] = useState('1990-05-15');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [shareWithDoctors, setShareWithDoctors] = useState(true);
  const [shareWithResearch, setShareWithResearch] = useState(false);
  const [shareAnalytics, setShareAnalytics] = useState(true);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [labResults, setLabResults] = useState(true);

  const [language, setLanguage] = useState(user?.preferredLanguage ?? 'en');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Profile Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your personal information, security, and preferences
        </p>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSaveProfile} loading={isSaving}>
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Current Password"
            type={showPasswords ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            endIcon={
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="text-slate-400 hover:text-slate-600">
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="New Password"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="At least 8 characters with uppercase, number, and symbol"
            />
            <Input
              label="Confirm New Password"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPassword && confirmPassword !== newPassword ? 'Passwords do not match' : undefined}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}>
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Privacy Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Share data with my doctors"
            description="Allow your doctors to view your health data and telemetry"
            checked={shareWithDoctors}
            onChange={setShareWithDoctors}
          />
          <ToggleRow
            label="Contribute to research"
            description="Anonymized data may be used for public health research"
            checked={shareWithResearch}
            onChange={setShareWithResearch}
          />
          <ToggleRow
            label="Analytics and usage data"
            description="Help improve the platform by sharing anonymous usage metrics"
            checked={shareAnalytics}
            onChange={setShareAnalytics}
          />
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow label="Email notifications" checked={emailNotifications} onChange={setEmailNotifications} />
          <ToggleRow label="SMS notifications" checked={smsNotifications} onChange={setSmsNotifications} />
          <ToggleRow label="Push notifications" checked={pushNotifications} onChange={setPushNotifications} />
          <div className="my-2 border-t border-slate-100 dark:border-slate-700" />
          <ToggleRow label="Appointment reminders" checked={appointmentReminders} onChange={setAppointmentReminders} />
          <ToggleRow label="Lab results available" checked={labResults} onChange={setLabResults} />
        </CardContent>
      </Card>

      {/* Language Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-500" />
            Language Preference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            label="Preferred Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'uz', label: "O'zbek (Uzbek)" },
              { value: 'ky', label: 'Kyrgyz' },
              { value: 'tg', label: 'Tajik' },
              { value: 'ru', label: 'Russian' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmation('');
        }}
        title="Delete Account"
        description="This action is permanent and cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmation !== 'DELETE'}
            >
              Delete Forever
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            All your health data, appointments, and records will be permanently deleted.
          </div>
          <Input
            label='Type "DELETE" to confirm'
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="DELETE"
          />
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle Row Component
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}
