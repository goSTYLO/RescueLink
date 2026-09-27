import { Layout } from '@/presentation/components/layout/Layout';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { Card } from 'antd';
import {
  HelpCircle,
  Mail,
  Phone,
  MessageCircle,
  FileText,
  Search,
  BookOpen,
  LayoutDashboard,
  Map,
  AlertTriangle,
  Building2,
  ScrollText,
  User,
  Settings,
  Shield,
  BarChart3,
} from 'lucide-react';

const GUIDES = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    summary: 'View overview stats and manage incidents from the main dashboard.',
    steps: [
      'Use the stat cards at the top to see active incidents, available units, and queue totals.',
      'Apply filters (status, severity, barangay, date range) to narrow the incidents table.',
      'Click an incident row to open its details, or use actions to assign units and update status.',
    ],
  },
  {
    id: 'insights',
    icon: BarChart3,
    title: 'Insights',
    summary: 'Period-based analytics for Super Admin (any department) and Department Admin (own department).',
    steps: [
      'Open Insights from the sidebar. Super Admin starts city-wide and can pick a department; Department Admin is locked to their own.',
      'Use date presets, type, severity, status, and barangay filters (the URL is shareable). On a phone, open the Filters disclosure first.',
      'Read headline clocks and SLA cards, then scroll: response matrix, demand map, operations, incident table. Each ? explains the metric. Export CSV or print to PDF.',
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
      'Select Edit to update your first name, last name, and profile photo (initials show when no photo is set).',
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

const CONTACT_CARDS = [
  {
    icon: Mail,
    title: 'Contact support',
    body: (
      <>
        <p style={{ margin: '0 0 4px', opacity: 0.75 }}>support@rescuelink.com</p>
        <p style={{ margin: 0, opacity: 0.75 }}>We typically respond within 24 hours on business days.</p>
      </>
    ),
  },
  {
    icon: Phone,
    title: 'Emergency hotline',
    body: (
      <p style={{ margin: 0, opacity: 0.75 }}>
        For urgent dispatch or system issues, contact your department supervisor or use the designated emergency line.
      </p>
    ),
  },
  {
    icon: FileText,
    title: 'Documentation',
    body: (
      <p style={{ margin: 0, opacity: 0.75 }}>
        Guides for incidents, departments, audit log, and map view. Check Settings for notification and permission options.
      </p>
    ),
  },
  {
    icon: MessageCircle,
    title: 'Feedback',
    body: (
      <>
        <p style={{ margin: '0 0 4px', opacity: 0.75 }}>feedback@rescuelink.com</p>
        <p style={{ margin: 0, opacity: 0.75 }}>Suggestions and bug reports welcome.</p>
      </>
    ),
  },
];

export function HelpSupportPage() {
  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Help & Support' }]} />
        <Card
          size="small"
          style={{ marginTop: 12, marginBottom: 12 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={18} />
              Help & Support
            </span>
          )}
        >
          <p style={{ margin: 0, opacity: 0.75 }}>
            Get assistance and resources for using RescueLink. Use the search bar in the header to find incidents,
            services, or agents quickly. For urgent dispatch issues, contact your department supervisor.
          </p>
        </Card>

        <Card
          size="small"
          style={{ marginBottom: 12 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} />
              Guides & instructions
            </span>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <Card key={guide.id} size="small" type="inner" title={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} />
                    {guide.title}
                  </span>
                )}>
                  <p style={{ marginTop: 0, opacity: 0.75 }}>{guide.summary}</p>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {guide.steps.map((step, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{step}</li>
                    ))}
                  </ol>
                </Card>
              );
            })}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
          {CONTACT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                size="small"
                title={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} />
                    {card.title}
                  </span>
                )}
              >
                {card.body}
              </Card>
            );
          })}
        </div>

        <Card size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Search size={20} />
            <p style={{ margin: 0 }}>
              <strong>Quick tip:</strong> Use the search bar in the header to find incidents, services, or agents quickly.
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
