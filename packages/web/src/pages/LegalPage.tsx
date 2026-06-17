import { Link } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Legal Page — Uzavita
// ---------------------------------------------------------------------------

export function LegalPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-sm font-bold text-white">U</span>
            </div>
            <span className="font-display text-lg font-bold text-slate-900 dark:text-white">Uzavita</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="bg-slate-50 px-6 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40">
            <Scale className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">
            Legal Information
          </h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            Last updated: June 2025
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-display">

          <h2>Terms of Service</h2>
          <p>
            By accessing or using the Uzavita platform ("Service"), you agree to be bound by these Terms of Service.
            If you do not agree to all of these terms, you may not access or use the Service.
          </p>

          <h3>1. Eligibility</h3>
          <p>
            You must be at least 18 years of age or the age of legal majority in your jurisdiction to use this Service.
            Healthcare professionals using the platform must hold valid medical licences in their operating jurisdictions.
          </p>

          <h3>2. Account Responsibilities</h3>
          <p>
            You are responsible for safeguarding the credentials used to access the Service. You agree not to share your
            login details with any third party. Any activity that occurs under your account is your responsibility.
          </p>

          <h3>3. Acceptable Use</h3>
          <p>
            You agree to use the Service only for lawful purposes and in accordance with these Terms. You shall not use
            the Service to transmit false or misleading medical information, interfere with the platform's security
            mechanisms, or attempt to access data belonging to other users.
          </p>

          <h3>4. Medical Disclaimer</h3>
          <p>
            Uzavita provides AI-assisted symptom triage and health information tools. These tools are not a substitute
            for professional medical advice, diagnosis or treatment. Always seek the advice of a qualified healthcare
            provider with any questions you may have regarding a medical condition. Never disregard professional medical
            advice or delay seeking it because of information provided by the Service.
          </p>

          <h3>5. Limitation of Liability</h3>
          <p>
            To the fullest extent permitted by law, Uzavita and its officers, directors, employees and agents shall not
            be liable for any indirect, incidental, special, consequential or punitive damages arising out of or relating
            to your use of the Service.
          </p>

          <h3>6. Modifications</h3>
          <p>
            We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes
            acceptance of the revised Terms. We will provide notice of material changes via the platform or email.
          </p>

          <hr />

          <h2>Privacy Policy</h2>

          <h3>Data We Collect</h3>
          <p>
            We collect information necessary to provide and improve the Service, including: account registration details
            (name, email, role), medical records and health data entered or uploaded by users, device telemetry data from
            connected wearable devices, usage analytics (pages visited, features used, session duration) and technical
            data (browser type, IP address, device identifiers).
          </p>

          <h3>How We Use Your Data</h3>
          <p>
            Your data is used to deliver and personalise the Service, run AI-assisted triage assessments, generate
            population-health analytics (using de-identified data only), improve our machine-learning models, communicate
            platform updates and security alerts, and comply with legal obligations.
          </p>

          <h3>Data Sharing</h3>
          <p>
            We do not sell personal data. We may share data with: healthcare providers involved in your care (with your
            consent), government health authorities when required by law or for public-health surveillance (in
            de-identified form), and trusted service providers who assist in operating the platform (bound by data
            processing agreements).
          </p>

          <h3>Data Security</h3>
          <p>
            All data in transit is encrypted using TLS 1.3. Patient records are encrypted at rest using AES-256.
            Role-based access control ensures users can only access data they are authorised to view. We conduct regular
            security audits and penetration testing to identify and remediate vulnerabilities.
          </p>

          <h3>Data Retention</h3>
          <p>
            Medical records are retained for the minimum period required by applicable healthcare regulations. Account
            data is retained for the duration of your active account and for a reasonable period thereafter to comply with
            legal obligations. You may request deletion of your data by contacting us.
          </p>

          <h3>Your Rights</h3>
          <p>
            Depending on your jurisdiction, you may have the right to access, correct, delete or port your personal data.
            You may also have the right to withdraw consent and lodge a complaint with a supervisory authority. To exercise
            these rights, please contact us using the information below.
          </p>

          <hr />

          <h2>Cookie Policy</h2>
          <p>
            Uzavita uses strictly necessary cookies to maintain your authenticated session and store user preferences
            (such as dark-mode selection). We do not use third-party advertising or tracking cookies. No data is shared
            with ad networks.
          </p>

          <hr />

          <h2>Contact</h2>
          <p>
            For questions about these legal terms, your data or the Service in general, please reach out via the
            contact mechanisms provided within the application or through our official communication channels.
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-600">
              <span className="text-xs font-bold text-white">U</span>
            </div>
            <span>&copy; {new Date().getFullYear()} Uzavita. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white">About</Link>
            <Link to="/legal" className="hover:text-slate-900 dark:hover:text-white">Legal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
