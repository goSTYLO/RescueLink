import { Layout } from '@/presentation/components/layout/Layout';
import { HelpCircle, Mail, Phone, MessageCircle, FileText, Search, BookOpen, LayoutDashboard, Map, AlertTriangle, Building2, ScrollText, User, Settings, Shield, ChevronRight } from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

const GUIDES = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    summary: 'View overview stats and manage incidents from the main dashboard.',
    steps: [
      'Use the stat cards at the top to see active incidents, available units, and response times.',
      'Apply filters (status, severity, barangay, date range) to narrow the incidents table.',
      'Click an incident row to open its details, or use actions to assign units and update status.',
    ],
  },
  {
    id: 'map',
    icon: Map,
    title: 'Map View',
    summary: 'See all incidents and units on an interactive map.',
    steps: [
      'Open Map View from the sidebar to display incidents and department units on the map.',
      'Use the filter bar to filter by department, barangay, or status.',
      'Click a marker to view brief details; click "View details" to go to the full incident page.',
    ],
  },
  {
    id: 'incidents',
    icon: AlertTriangle,
    title: 'Incident details',
    summary: 'View and manage a single incident.',
    steps: [
      'Use the Details tab for reporter info, location, severity, and AI suggestions.',
      'Use Timeline, Coordination, and Escalation tabs for updates and notes.',
      'Assign departments or units, escalate severity, or close the incident from the actions available on the page.',
    ],
  },
  {
    id: 'departments',
    icon: Building2,
    title: 'Departments',
    summary: 'Manage departments, units, and personnel.',
    steps: [
      'From Departments, add a new department or edit an existing one (name, type, units, personnel).',
      'Open a department to see its Units, Personnel, and Active Tasks in tabs.',
      'Use "Add Unit" or "Add Personnel" to grow the roster; edit or delete from the list actions.',
    ],
  },
  {
    id: 'audit',
    icon: ScrollText,
    title: 'Audit Log',
    summary: 'Review dispatcher actions for accountability.',
    steps: [
      'Open Audit Log from the sidebar to see login, password, and dispatch actions.',
      'Use filters (Action, Resource, date range) and Refresh to update the list.',
      'Use pagination at the bottom to browse all records.',
    ],
  },
  {
    id: 'profile',
    icon: User,
    title: 'Profile',
    summary: 'Manage your account and session.',
    steps: [
      'View your name, email, role, and member‑since date in Profile Information.',
      'Use "Change Password" to update your password (you will need to log in again after).',
      'Use "Logout" to end your session securely.',
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    summary: 'Configure system preferences (Admin only).',
    steps: [
      'Allow or disallow operator incident creation and supervisor override under User Role Management.',
      'Set Fire Critical and Medical Warning thresholds under Severity Thresholds.',
      'Turn SMS, email, and push notifications on or off under Notification Settings.',
    ],
  },
  {
    id: 'admin',
    icon: Shield,
    title: 'Admin Actions',
    summary: 'Emergency and administrative controls (Admin only).',
    steps: [
      'Disaster Control: select disaster type and affected barangays, then activate emergency protocols.',
      'Duplicate Management: review and handle incidents marked as duplicates.',
      'Admin Logs: filter and review admin actions (escalations, closures, role changes).',
    ],
  },
];

export function HelpSupportPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const cardBase = 'rounded-2xl border transition-all duration-300 overflow-hidden';
  const glassCard = `${cardBase} glass`;
  const neumorphicCard = isLight
    ? `${cardBase} bg-card neumorphic-light hover:shadow-[10px_10px_20px_rgba(209,213,219,0.85),-10px_-10px_20px_rgba(255,255,255,0.95)]`
    : `${cardBase} bg-card/80 neumorphic-dark hover:shadow-[10px_10px_24px_rgba(0,0,0,0.4),-6px_-6px_16px_rgba(19,65,120,0.3)]`;

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-8 min-h-full max-w-7xl mx-auto">
        <div className={`${heroCardClass} mb-6`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <HelpCircle className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Help & Support</h1>
              <p className="text-muted mt-1">Get assistance and resources for using RescueLink</p>
              <p className="text-foreground/90 text-sm max-w-2xl mt-2">
                Use the search bar in the header to find incidents, services, or agents quickly. For urgent dispatch issues, contact your department supervisor.
              </p>
            </div>
          </div>
        </div>

        {/* Guides & instructions */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
            }`}>
              <BookOpen className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Guides & instructions</h2>
              <p className="text-sm text-muted">Step-by-step instructions for using RescueLink</p>
            </div>
          </div>
          <div className="space-y-4">
            {GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <div key={guide.id} className={`${neumorphicCard} p-5`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isLight ? 'neumorphic-light-inset bg-gray-50 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
                    }`}>
                      <Icon className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-0.5">{guide.title}</h3>
                      <p className="text-sm text-muted mb-3">{guide.summary}</p>
                      <ol className="space-y-1.5">
                        {guide.steps.map((step, i) => (
                          <li key={i} className="flex gap-2 text-sm text-foreground/90">
                            <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-xs font-semibold bg-primary/20 text-primary">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" strokeWidth={2} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cards grid: neumorphism + glass mix */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className={`${neumorphicCard} p-6`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isLight ? 'neumorphic-light-inset bg-gray-50 text-primary' : 'neumorphic-dark-inset bg-secondary/50 text-primary'
              }`}>
                <Mail className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg mb-1">Contact support</h3>
                <p className="text-muted text-sm mb-2">support@rescuelink.com</p>
                <p className="text-muted text-sm">We typically respond within 24 hours on business days.</p>
              </div>
            </div>
          </div>

          <div className={`${neumorphicCard} p-6`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isLight ? 'neumorphic-light-inset bg-gray-50 text-primary' : 'neumorphic-dark-inset bg-secondary/50 text-primary'
              }`}>
                <Phone className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg mb-1">Emergency hotline</h3>
                <p className="text-muted text-sm">For urgent dispatch or system issues, contact your department supervisor or use the designated emergency line.</p>
              </div>
            </div>
          </div>

          <div className={`${neumorphicCard} p-6`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isLight ? 'neumorphic-light-inset bg-gray-50 text-primary' : 'neumorphic-dark-inset bg-secondary/50 text-primary'
              }`}>
                <FileText className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg mb-1">Documentation</h3>
                <p className="text-muted text-sm">Guides for incidents, departments, audit log, and map view. Check Settings for notification and permission options.</p>
              </div>
            </div>
          </div>

          <div className={`${neumorphicCard} p-6`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isLight ? 'neumorphic-light-inset bg-gray-50 text-primary' : 'neumorphic-dark-inset bg-secondary/50 text-primary'
              }`}>
                <MessageCircle className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg mb-1">Feedback</h3>
                <p className="text-muted text-sm mb-2">feedback@rescuelink.com</p>
                <p className="text-muted text-sm">Suggestions and bug reports welcome.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom tip: glass */}
        <div className={`${glassCard} mt-10 p-5 rounded-2xl flex items-center gap-4`}>
          <Search className="w-6 h-6 text-primary flex-shrink-0" strokeWidth={2} />
          <p className="text-sm text-foreground/90">
            <strong>Quick tip:</strong> Use the search bar in the header to find incidents, services, or agents quickly.
          </p>
        </div>
      </div>
    </Layout>
  );
}
