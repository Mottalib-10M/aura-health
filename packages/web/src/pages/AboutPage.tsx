import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, Globe, Shield, Brain, Users, Stethoscope, Activity, Building2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// About Page — Uzavita
// ---------------------------------------------------------------------------

export function AboutPage() {
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
      <header className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-6 py-20 dark:from-primary-950/30 dark:via-slate-950 dark:to-secondary-950/30">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            About Uzavita
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Building the healthcare infrastructure that Central Asia deserves. Uzavita leverages artificial intelligence,
            real-time telemetry and modern software engineering to bridge the gap between patients, physicians, hospitals
            and public-health analysts across the region.
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Mission */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
              <Heart className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Our Mission</h2>
          </div>
          <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              Healthcare in Central Asia faces a unique set of challenges. Vast distances separate rural communities from
              urban medical centers. Infrastructure constraints limit the availability of specialist consultations. Language
              barriers, fragmented medical records and inconsistent supply chains further complicate care delivery. Uzavita
              was founded with a singular purpose: to dismantle these barriers through technology and make quality healthcare
              accessible to every person in the region.
            </p>
            <p>
              Our mission extends beyond individual patient care. We believe that systemic improvement requires systemic
              visibility. By aggregating anonymised health data across facilities, Uzavita enables public-health analysts to
              detect disease outbreaks earlier, allocate pharmaceutical supplies more efficiently and inform evidence-based
              policy decisions. The platform is designed from the ground up to serve four distinct stakeholders: patients,
              doctors, hospital administrators and government health analysts.
            </p>
          </div>
        </section>

        {/* Platform overview */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-100 dark:bg-secondary-900/40">
              <Brain className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">The Platform</h2>
          </div>
          <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              Uzavita is a full-stack digital health ecosystem. At its core sits an AI-driven symptom-triage engine that
              guides patients through a structured assessment, produces a preliminary urgency classification and routes
              cases to the most appropriate medical professional. This is not a replacement for clinical judgement; it is
              a force multiplier that ensures the right patients reach the right doctors at the right time.
            </p>
            <p>
              For physicians, Uzavita provides a real-time dashboard that surfaces patient vitals collected from wearable
              devices and IoT sensors, displays triage recommendations alongside full medical histories, and tracks
              treatment-efficacy metrics over time. Appointment scheduling, teleconsultation workflows and electronic
              health record (EHR) management are tightly integrated so that no context is lost between interactions.
            </p>
            <p>
              Hospital administrators gain visibility into departmental workloads, bed occupancy, staff allocation and
              resource utilisation. Automated reporting reduces administrative overhead and frees clinical staff to focus
              on patient care. The platform supports multi-facility deployments, allowing regional hospital networks to
              share resources and coordinate referrals seamlessly.
            </p>
            <p>
              At the population level, Uzavita aggregates de-identified data into epidemiological dashboards. Analysts
              can monitor disease prevalence, track vaccination coverage, model outbreak trajectories and optimise the
              pharmaceutical supply chain across the entire region. These capabilities are especially critical in
              Central Asia, where remote areas often experience delayed reporting and stock-outs of essential medicines.
            </p>
          </div>
        </section>

        {/* Key capabilities */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 dark:bg-accent-900/40">
              <Activity className="h-5 w-5 text-accent-600 dark:text-accent-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Key Capabilities</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { icon: Brain, title: 'AI Symptom Triage', desc: 'Machine-learning models trained on regional health data classify patient symptoms by urgency and route cases to the right specialist.' },
              { icon: Activity, title: 'Real-Time Telemetry', desc: 'Continuous monitoring of heart rate, blood pressure, SpO2 and other vitals via connected wearable devices and IoT sensors.' },
              { icon: Stethoscope, title: 'Efficacy Tracking', desc: 'Longitudinal treatment-outcome analytics help physicians compare protocols and improve care quality over time.' },
              { icon: Globe, title: 'Epidemiological Surveillance', desc: 'Population-level dashboards detect outbreaks, track vaccination coverage and model disease trajectories across the region.' },
              { icon: Building2, title: 'Hospital Resource Management', desc: 'Real-time visibility into bed occupancy, staff allocation, equipment availability and departmental workloads.' },
              { icon: Shield, title: 'Supply-Chain Optimisation', desc: 'Predictive analytics ensure essential medicines reach remote areas before stock-outs occur.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                <Icon className="mb-3 h-6 w-6 text-primary-500" />
                <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technology */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
              <Shield className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Technology &amp; Architecture</h2>
          </div>
          <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              Uzavita is built on a modern, cloud-native architecture. The front end is a single-page application
              written in React 19 with TypeScript, styled using Tailwind CSS and powered by Vite for near-instant
              development builds. State management is handled by Zustand and TanStack Query, ensuring responsive
              interfaces even over low-bandwidth connections common in rural Central Asian clinics.
            </p>
            <p>
              The back end exposes a GraphQL API backed by a Node.js runtime and a PostgreSQL database. Machine-learning
              services are implemented in Python using FastAPI (uvicorn) and deployed as independent microservices. The
              entire stack is containerised with Docker and orchestrated via Kubernetes, with overlays for development,
              staging and production environments. Railway handles backend hosting while Vercel serves the front end.
            </p>
            <p>
              Security is a first-class concern. All data in transit is encrypted via TLS 1.3. Patient records are
              encrypted at rest. Role-based access control (RBAC) ensures that each user sees only the data they are
              authorised to access. Audit logging captures every clinical interaction for compliance and accountability.
              The platform is designed to align with emerging healthcare data-protection regulations across the region.
            </p>
          </div>
        </section>

        {/* Team */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-100 dark:bg-secondary-900/40">
              <Users className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Leadership</h2>
          </div>
          <div className="flex flex-col items-start gap-6 rounded-2xl border border-slate-200 p-8 dark:border-slate-800 sm:flex-row sm:items-center">
            <img
              src="/team/mottalib-radif.jpg"
              alt="Mottalib Radif"
              className="h-28 w-28 rounded-2xl object-cover shadow-md"
            />
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Mottalib Radif</h3>
              <p className="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400">Health Technology and Digital Wellness Specialist</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <GraduationCap className="h-4 w-4" />
                MBA, INSEAD
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Passionate about health technology and digital wellness solutions, MBA INSEAD graduate. Specialized in
                building innovative health platforms that leverage data science for personalized wellness insights. His
                vision for Uzavita is to create a scalable healthcare platform that grows alongside the economies and
                populations of Central Asia, turning data into better health outcomes for millions of people.
              </p>
            </div>
          </div>
        </section>

        {/* Vision */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 dark:bg-accent-900/40">
              <Globe className="h-5 w-5 text-accent-600 dark:text-accent-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Our Vision for the Future</h2>
          </div>
          <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              The road ahead is ambitious. In the near term, we are expanding our AI triage models to support additional
              languages — including Kazakh, Uzbek, Tajik and Kyrgyz — so that patients can describe symptoms in their
              native language. We are also deepening integration with wearable device ecosystems to support continuous
              glucose monitoring, fall detection and maternal health tracking.
            </p>
            <p>
              On the infrastructure side, we are working with government health ministries to establish data-sharing
              agreements that will allow Uzavita to serve as the backbone of national health information systems.
              Interoperability with existing hospital information systems (HIS) and laboratory information management
              systems (LIMS) is a key priority, and we are adopting HL7 FHIR standards to ensure seamless data exchange.
            </p>
            <p>
              Longer term, Uzavita aims to become the definitive healthcare data platform for Central Asia. By combining
              clinical decision support, population-health analytics and supply-chain intelligence in a single ecosystem,
              we can help the region leapfrog legacy healthcare infrastructure and build a system that is modern, equitable
              and resilient. Every patient record entered, every vital sign monitored and every outbreak detected brings
              us closer to a future where geography is no longer a barrier to quality healthcare.
            </p>
            <p>
              We believe healthcare is a fundamental human right, and technology is the most powerful lever we have to
              make that right a reality for everyone — no matter where they live.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
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
