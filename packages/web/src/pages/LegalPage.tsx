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
            Last updated: June 2026
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-display">

          <p>
            In accordance with applicable consumer protection and digital services legislation, the following
            legal information is provided to users and visitors of the Uzavita platform. By accessing and
            using this platform, users acknowledge and accept these terms in their entirety.
          </p>

          <h2>1. Publisher Information</h2>
          <p>
            <strong>Platform Name:</strong> Uzavita<br />
            <strong>Publisher:</strong> Mottalib Radif<br />
            <strong>Contact:</strong> contact@uzavita.com<br />
            <strong>Editor-in-Chief:</strong> Mottalib Radif
          </p>
          <p>
            The publisher assumes editorial responsibility for all content published on the platform,
            with the exception of AI-generated content which depends on data entered by the user and
            on machine learning models used at the date of consultation. Uzavita is an AI-assisted
            health triage and information platform designed to support, not replace, professional medical
            guidance.
          </p>

          <h2>2. Hosting</h2>
          <p>
            The platform is hosted by:<br />
            <strong>GitHub Pages</strong> — GitHub, Inc.<br />
            88 Colin P Kelly Jr Street, San Francisco, CA 94107, United States<br />
            Website: https://pages.github.com
          </p>
          <p>
            GitHub Pages is a static website hosting service provided by GitHub, Inc., a subsidiary of
            Microsoft Corporation. The infrastructure relies on a global content delivery network (CDN)
            that serves pages from the server closest to each visitor. HTTPS is used to encrypt all data
            in transit. As a technical host, GitHub, Inc. does not exercise any editorial control over
            the platform's content.
          </p>

          <h2>3. Intellectual Property</h2>
          <p>
            All content on the Uzavita platform, including but not limited to text, graphics, logos,
            icons, images, software, algorithms, source code, page layouts and design elements, is the
            property of Mottalib Radif and is protected by international copyright laws and intellectual
            property regulations.
          </p>
          <p>
            You may not reproduce, distribute, display, sell, lease, transmit, create derivative works
            from, translate, modify, reverse-engineer, disassemble, decompile, or otherwise exploit this
            platform or any portion of it unless expressly permitted in writing. Users are authorised to
            use the platform for strictly personal and private use.
          </p>

          <hr />

          <h2>4. Terms of Service</h2>
          <p>
            By accessing or using the Uzavita platform ("Service"), you agree to be bound by these Terms of Service.
            If you do not agree to all of these terms, you may not access or use the Service.
          </p>

          <h3>4.1 Eligibility</h3>
          <p>
            You must be at least 18 years of age or the age of legal majority in your jurisdiction to use this Service.
            Healthcare professionals using the platform must hold valid medical licences in their operating jurisdictions.
          </p>

          <h3>4.2 Account Responsibilities</h3>
          <p>
            You are responsible for safeguarding the credentials used to access the Service. You agree not to share your
            login details with any third party. Any activity that occurs under your account is your responsibility.
          </p>

          <h3>4.3 Acceptable Use</h3>
          <p>
            You agree to use the Service only for lawful purposes and in accordance with these Terms. You shall not use
            the Service to transmit false or misleading medical information, interfere with the platform's security
            mechanisms, or attempt to access data belonging to other users. The publisher uses all reasonable means to
            ensure quality access but is under no obligation of result. Access may be interrupted at any time for
            maintenance or updates.
          </p>

          <h3>4.4 Medical Disclaimer</h3>
          <p>
            Uzavita provides AI-assisted symptom triage and health information tools. These tools are not a substitute
            for professional medical advice, diagnosis or treatment. Always seek the advice of a qualified healthcare
            provider with any questions you may have regarding a medical condition. Never disregard professional medical
            advice or delay seeking it because of information provided by the Service.
          </p>
          <p>
            The AI-generated health assessments are based on statistical models and publicly available medical knowledge.
            They are intended to provide general guidance only and should not be relied upon as a definitive diagnosis or
            treatment plan. Individual medical conditions may vary significantly, and only a qualified healthcare
            professional can provide personalised medical advice after a proper examination.
          </p>

          <h3>4.5 Limitation of Liability</h3>
          <p>
            To the fullest extent permitted by law, Uzavita and its officers, directors, employees and agents shall not
            be liable for any indirect, incidental, special, consequential or punitive damages arising out of or relating
            to your use of the Service. This includes but is not limited to damages resulting from inaccurate health
            assessments, delayed treatment, or any medical decisions made based on information provided by the platform.
          </p>

          <h3>4.6 Modifications</h3>
          <p>
            We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes
            acceptance of the revised Terms. We will provide notice of material changes via the platform or email.
          </p>

          <hr />

          <h2>5. Privacy Policy</h2>
          <p>
            Uzavita is committed to protecting your privacy in compliance with the General Data Protection
            Regulation (GDPR — Regulation EU 2016/679) and all applicable data protection legislation.
          </p>

          <h3>5.1 Data We Collect</h3>
          <p>
            We collect information necessary to provide and improve the Service, including: account registration details
            (name, email, role), medical records and health data entered or uploaded by users, device telemetry data from
            connected wearable devices, usage analytics (pages visited, features used, session duration) and technical
            data (browser type, IP address, device identifiers).
          </p>

          <h3>5.2 How We Use Your Data</h3>
          <p>
            Your data is used to deliver and personalise the Service, run AI-assisted triage assessments, generate
            population-health analytics (using de-identified data only), improve our machine-learning models, communicate
            platform updates and security alerts, and comply with legal obligations.
          </p>

          <h3>5.3 Data Sharing</h3>
          <p>
            We do not sell personal data. We may share data with: healthcare providers involved in your care (with your
            consent), government health authorities when required by law or for public-health surveillance (in
            de-identified form), and trusted service providers who assist in operating the platform (bound by data
            processing agreements). We do not share data with advertising platforms or third-party marketing services.
          </p>

          <h3>5.4 Data Security</h3>
          <p>
            All data in transit is encrypted using TLS 1.3. Patient records are encrypted at rest using AES-256.
            Role-based access control ensures users can only access data they are authorised to view. We conduct regular
            security audits and penetration testing to identify and remediate vulnerabilities.
          </p>

          <h3>5.5 Data Retention</h3>
          <p>
            Medical records are retained for the minimum period required by applicable healthcare regulations. Account
            data is retained for the duration of your active account and for a reasonable period thereafter to comply with
            legal obligations. You may request deletion of your data by contacting us.
          </p>

          <hr />

          <h2>6. Data Protection (GDPR)</h2>
          <p>
            In accordance with Articles 15 to 22 of the GDPR, every user has the following rights:
          </p>
          <ul>
            <li><strong>Right of access</strong> (Art. 15): obtain confirmation of whether personal data is being processed and, if so, obtain a copy.</li>
            <li><strong>Right to rectification</strong> (Art. 16): obtain correction of inaccurate or incomplete data.</li>
            <li><strong>Right to erasure</strong> (Art. 17, "right to be forgotten"): obtain deletion of personal data when conditions are met.</li>
            <li><strong>Right to restriction of processing</strong> (Art. 18): obtain restriction in certain cases.</li>
            <li><strong>Right to data portability</strong> (Art. 20): receive data in a structured, machine-readable format.</li>
            <li><strong>Right to object</strong> (Art. 21): object to processing on grounds relating to your situation.</li>
            <li><strong>Right to withdraw consent</strong> (Art. 7): withdraw consent at any time.</li>
          </ul>
          <p>
            To exercise these rights, contact us at contact@uzavita.com. We undertake to respond within 30 days.
            Users also have the right to lodge a complaint with a supervisory authority.
          </p>

          <hr />

          <h2>7. Cookie Policy</h2>
          <p>
            Uzavita uses strictly necessary cookies to maintain your authenticated session and store user preferences
            (such as dark-mode selection). We do not use third-party advertising or tracking cookies. No data is shared
            with ad networks.
          </p>
          <p>
            User preferences that do not require server-side processing are stored in the browser's localStorage,
            which is not a cookie and is never transmitted to our servers. You can configure your browser to refuse
            cookies or delete existing cookies at any time.
          </p>

          <hr />

          <h2>8. Governing Law</h2>
          <p>
            This legal notice is governed by and construed in accordance with applicable law. Any disputes arising
            from the use of this platform shall be subject to the exclusive jurisdiction of the competent courts.
            The potential invalidity of any clause shall not affect the validity of the remaining provisions.
          </p>

          <hr />

          <h2>9. Contact</h2>
          <p>
            For questions about these legal terms, your data or the Service in general, please reach out via
            email at contact@uzavita.com or through the contact mechanisms provided within the application.
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
