import { Link } from 'react-router-dom';
import { Shield, Radio, Brain, ClipboardList } from 'lucide-react';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import { ThemeToggle } from '@/presentation/components/common/ThemeToggle';
import Timeline from '@/presentation/components/ui/Timeline';
import { AuthPageBackground } from '@/presentation/components/layout/AuthPageBackground.jsx';
import illustration from '@/presentation/assets/illustration.svg';
import { DEV_MODE } from '@/core/config/app.config';
import { getStoredUser, hasValidAuthSession } from '@/core/auth/session';
import { getDefaultRouteByRole, normalizeRole } from '@/core/constants';

const TOP_JOURNEY = [
  {
    id: 'report',
    heading: 'Report',
    content: 'Citizens share location-aware reports with audio and media through the mobile app.',
  },
  {
    id: 'classify',
    heading: 'Classify',
    content: 'Incident audio is transcribed and assessed for type and severity to speed triage.',
  },
  {
    id: 'dispatch',
    heading: 'Dispatch',
    content: 'Dispatchers review, prioritize, and assign the right responders and units.',
  },
  {
    id: 'coordinate',
    heading: 'Coordinate',
    content: 'Teams see live updates on the map and stay aligned as the situation evolves.',
  },
];

const BOTTOM_JOURNEY = [
  {
    id: 'respond',
    heading: 'Respond',
    content: 'Department personnel and responders act on assigned tasks in the field.',
  },
  {
    id: 'status',
    heading: 'Update status',
    content: 'Status changes flow back to dispatch so everyone shares the same picture.',
  },
  {
    id: 'record',
    heading: 'Review record',
    content: 'Actions are logged for accountability and after-action review.',
  },
];

const FEATURES = [
  {
    icon: Radio,
    title: 'Citizen reporting',
    text: 'Phone-authenticated mobile reports with audio, media, and location context.',
  },
  {
    icon: ClipboardList,
    title: 'Dispatcher workflow',
    text: 'Web console for triage, dispatch, assignment, and operational oversight.',
  },
  {
    icon: Brain,
    title: 'AI-assisted triage',
    text: 'Automatic transcription and classification to help prioritize the queue.',
  },
  {
    icon: Shield,
    title: 'Authorized access',
    text: 'Role-based access for personnel through super admin. Sensitive data stays protected.',
  },
];

function AuthActions({ className = '' }) {
  const showDashboardLink = DEV_MODE || hasValidAuthSession();
  let dashboardPath = '/dashboard';
  if (showDashboardLink) {
    try {
      dashboardPath = getDefaultRouteByRole(normalizeRole(getStoredUser().role));
    } catch (_) {}
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link
        to="/login"
        className="inline-flex items-center justify-center rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white hover:bg-secondary-hover transition-colors"
      >
        Sign in
      </Link>
      {showDashboardLink ? (
        <Link
          to={dashboardPath}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-card transition-colors"
        >
          Open dashboard
        </Link>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <AuthPageBackground />

      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link to="/" className="shrink-0">
            <BrandLogo size="md" squircleMark />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthActions />
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[85vh] max-w-6xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
          Dagupan City · Emergency response
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          One tap. One report.{' '}
          <span className="text-primary">Faster response.</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          <strong className="font-semibold text-foreground">RescueLink</strong> connects citizen
          reports with city dispatch and department teams. This website is the{' '}
          <strong className="font-semibold text-foreground">staff console</strong> for personnel
          through super admin — not the public reporting app.
        </p>
        <AuthActions className="justify-center mt-2" />
        <span className="mt-4 animate-bounce text-muted" aria-hidden>
          ↓
        </span>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm transition-smooth hover-lift"
            >
              <div className="mb-3 inline-flex rounded-lg bg-primary/15 p-2 text-primary">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-6 pb-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
          End-to-end flow
        </p>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
          Scroll — the track moves sideways and each step reveals as you move through the response
          lifecycle.
        </p>
      </section>

      <Timeline
        title="Response lifecycle"
        periodLabel="Field to close-out"
        topItems={TOP_JOURNEY}
        bottomItems={BOTTOM_JOURNEY}
        activeColor="#FF4F52"
        backgroundColor="var(--color-background)"
        textColor="var(--color-foreground)"
        mutedTextColor="var(--color-muted)"
        imageUrl={illustration}
        imageAlt="RescueLink emergency response illustration"
        duration={1.4}
      />

      <footer className="relative z-10 border-t border-border bg-card/40 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <BrandLogo size="sm" squircleMark />
            <p className="mt-3 max-w-md text-sm text-muted">
              Secure emergency response management for authorized city personnel. Citizens report
              incidents through the RescueLink mobile app.
            </p>
          </div>
          <AuthActions className="justify-center sm:justify-end" />
        </div>
      </footer>
    </div>
  );
}
