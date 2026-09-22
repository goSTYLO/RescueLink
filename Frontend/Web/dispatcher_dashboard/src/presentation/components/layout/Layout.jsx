import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge, Button, Dropdown, Layout as AntLayout, List, Menu, Popover, Select } from 'antd';
import { getNotifications, getUnreadCount, markAllAsRead, markNotificationAsRead } from '@/data/api/notifications.api';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Map, User, FileText, Settings, Shield, ShieldCheck, Building2, LogOut, Bell, HelpCircle, AlertCircle, CheckCircle, Info, Users, ClipboardList, UserCheck, BarChart3, PanelLeft, PanelLeftClose } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/infrastructure/firebase';
import { logout as logoutApi, fetchAvatarBlob, invalidateAvatarCache } from '@/data/api/auth.api';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import { ProfileAvatar } from '@/presentation/components/common/ProfileAvatar';
import { GlobalSearch } from '@/presentation/components/common/GlobalSearch';
import { alertUser } from '@/presentation/feedback/alertUser';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { ThemeToggle } from '@/presentation/components/common/ThemeToggle';
import { getDefaultRouteByRole, ROLES, normalizeRole } from '@/core/constants';
import { DEV_MODE } from '@/core/config/app.config';
import { clearAuthSession, getAuthToken, getStoredUser, persistAuthUser } from '@/core/auth/session';
import { formatIncidentTypesLabel } from '@/core/utils/incidentDisplay';
import { NotificationPromptBanner } from '@/presentation/components/common/NotificationPromptBanner';
import { shellBorderColor } from '@/presentation/theme/antdTheme';

const { Sider, Header, Content } = AntLayout;
const SIDEBAR_STORAGE_KEY = 'rescuelink_sidebar_collapsed';

function formatNotificationTime(sentAt) {
  if (!sentAt) return '';
  const d = new Date(sentAt);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const NAV_SUPER_ADMIN = [
  { title: 'OVERVIEW', items: [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Map, label: 'Map View', path: '/map' },
    { icon: BarChart3, label: 'Insights', path: '/insights' },
  ]},
  { title: 'OPERATIONS', items: [
    { icon: UserCheck, label: 'Responder Applications', path: '/responder-applications' },
    { icon: Building2, label: 'Departments', path: '/departments' },
    { icon: FileText, label: 'Audit Log', path: '/audit' },
    { icon: ShieldCheck, label: 'Admin Actions', path: '/adminactions' },
  ]},
  { title: 'ORGANIZATION', items: [
    { icon: Shield, label: 'Team', path: '/team' },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]},
];

const NAV_DEPARTMENT_ADMIN = [
  { title: 'DEPARTMENT', items: [
    { icon: Home, label: 'Dashboard', path: '/department/dashboard' },
    { icon: BarChart3, label: 'Insights', path: '/insights' },
    { icon: Users, label: 'Personnel', path: '/department/personnel' },
  ]},
  { title: 'GENERAL', items: [
    { icon: Map, label: 'Map View', path: '/map' },
    { icon: User, label: 'Profile', path: '/profile' },
  ]},
];

const NAV_PERSONNEL = [
  { title: 'TASKS', items: [
    { icon: ClipboardList, label: 'My Tasks', path: '/department/tasks' },
  ]},
  { title: 'GENERAL', items: [
    { icon: Map, label: 'Map View', path: '/map' },
    { icon: User, label: 'Profile', path: '/profile' },
  ]},
];

const NAV_DEPARTMENT_HEAD = [
  { title: 'INCIDENTS', items: [
    { icon: ClipboardList, label: 'Assigned Incidents', path: '/department/assigned-incidents' },
  ]},
];

const NAV_DISPATCHER = [
  { title: 'OVERVIEW', items: [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Map, label: 'Map View', path: '/map' },
  ]},
  { title: 'OPERATIONS', items: [
    { icon: UserCheck, label: 'Responder Applications', path: '/responder-applications' },
  ]},
  { title: 'GENERAL', items: [
    { icon: User, label: 'Profile', path: '/profile' },
  ]},
];

const DEV_ROLE_PRESETS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin', user: { name: 'Super Admin', username: 'Super Admin', email: 'admin@rescuelink.dagupan.gov.ph', role: ROLES.SUPER_ADMIN, department: 'All', departmentId: null } },
  { value: ROLES.DISPATCHER, label: 'Dispatcher', user: { name: 'Dispatcher Cruz', username: 'Dispatcher Cruz', email: 'dispatcher@rescuelink.dagupan.gov.ph', role: ROLES.DISPATCHER, department: 'Operations', departmentId: null } },
  { value: ROLES.DEPARTMENT_HEAD, label: 'Dept Head', user: { name: 'Dept Head', username: 'Dept Head', email: 'head@dept.dagupan.gov', role: ROLES.DEPARTMENT_HEAD, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 1 } },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Dept Admin (Fire)', user: { name: 'Fire Chief Mendoza', username: 'Fire Chief Mendoza', email: 'mendoza@fire.dagupan.gov', role: ROLES.DEPARTMENT_ADMIN, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 'bfp' } },
  { value: ROLES.PERSONNEL, label: 'Personnel (Fire)', user: { name: 'Officer Pedro Ramos', username: 'Officer Pedro Ramos', email: 'pedro.ramos@pnp.dagupan.gov', role: ROLES.PERSONNEL, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 'bfp' } },
];

function toastNotice({ icon, title, text, timer = 5000 }) {
  alertUser({ toast: true, icon, title, text, timer, showConfirmButton: true });
}

function activeMenuKey(pathname, sections) {
  const paths = sections.flatMap((section) => section.items.map((item) => item.path)).concat('/help');
  const match = paths
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? [match] : [];
}

const ACCOUNT_ITEMS = [
  { icon: HelpCircle, label: 'Help & Support', path: '/help' },
  { icon: LogOut, label: 'Log out', path: 'logout' },
];

function menuItem(item) {
  const Icon = item.icon;
  return { key: item.path, icon: <Icon size={18} />, label: item.label, title: item.label };
}

function menuGroupLabel(title, collapsed) {
  if (!collapsed) return title;
  return (
    <span className="sidebar-nav-group-label" data-nav-group={title}>
      {title}
    </span>
  );
}

function menuItemsFor(sections, collapsed) {
  const groups = [...sections, { title: 'ACCOUNT', items: ACCOUNT_ITEMS }];
  return groups.map((section) => ({
    type: 'group',
    label: menuGroupLabel(section.title, collapsed),
    children: section.items.map(menuItem),
  }));
}

export function Layout({ children }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? 'false');
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsAuthError, setNotificationsAuthError] = useState(null);
  const notificationRefreshRef = useRef(null);

  const { status: wsStatus, clearNotifications, lastHighSeverity, clearLastHighSeverity, lastDispatched, clearLastDispatched, lastBackupRequested, clearLastBackupRequested, lastBackupJoined, clearLastBackupJoined, lastEscalated, clearLastEscalated } = useIncidentWebSocketStatus();
  const [apiNotifications, setApiNotifications] = useState([]);
  const [apiUnreadCount, setApiUnreadCount] = useState(0);

  const fetchApiNotifications = useCallback(async () => {
    const token = getAuthToken();
    if (DEV_MODE && !token) {
      setApiNotifications([]);
      setApiUnreadCount(0);
      setNotificationsAuthError('Sign in to see notifications');
      return;
    }

    try {
      setNotificationsAuthError(null);
      const [list, count] = await Promise.all([getNotifications({ limit: 50 }), getUnreadCount()]);
      setApiNotifications(Array.isArray(list) ? list : []);
      setApiUnreadCount(count);
    } catch (err) {
      setNotificationsAuthError(err?.message || 'Failed to load notifications');
    }
  }, []);

  useEffect(() => {
    fetchApiNotifications();
  }, [fetchApiNotifications]);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const loadHeaderAvatar = async () => {
      const token = getAuthToken();
      if (!token) {
        setHeaderAvatarUrl(null);
        return;
      }
      try {
        const blob = await fetchAvatarBlob();
        if (cancelled) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setHeaderAvatarUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
          });
        } else {
          setHeaderAvatarUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } catch (_) {
        if (!cancelled) setHeaderAvatarUrl(null);
      }
    };

    loadHeaderAvatar();
    const onProfileUpdated = () => {
      invalidateAvatarCache();
      loadHeaderAvatar();
    };
    window.addEventListener('profile-updated', onProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('profile-updated', onProfileUpdated);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    if (notificationsOpen) fetchApiNotifications();
  }, [notificationsOpen, fetchApiNotifications]);

  useEffect(() => {
    const onIncidentUpdated = () => {
      if (notificationRefreshRef.current) clearTimeout(notificationRefreshRef.current);
      notificationRefreshRef.current = setTimeout(() => {
        fetchApiNotifications();
      }, 500);
    };

    window.addEventListener('incident:updated', onIncidentUpdated);
    return () => {
      window.removeEventListener('incident:updated', onIncidentUpdated);
      if (notificationRefreshRef.current) clearTimeout(notificationRefreshRef.current);
    };
  }, [fetchApiNotifications]);

  const mapApiToUi = (n) => {
    const eventType = n.event_type || ((n.message || '').toLowerCase().includes('assigned') ? 'dispatched' : null);
    return {
      id: `api-${n.notification_id}`,
      notificationId: n.notification_id,
      eventType: eventType ? `incident:${eventType}` : null,
      type: (n.message || '').toLowerCase().includes('resolved') ? 'success' : (n.message || '').toLowerCase().includes('reported') || (n.message || '').toLowerCase().includes('escalat') || (n.message || '').toLowerCase().includes('assistance') ? 'alert' : 'info',
      title: (n.message || 'Notification').slice(0, 80),
      body: n.message || '',
      time: formatNotificationTime(n.sent_at),
      unread: !n.is_read,
      reportId: n.report_id,
    };
  };

  useEffect(() => {
    if (!lastHighSeverity?.data) return;
    const d = lastHighSeverity.data;
    toastNotice({
      icon: 'warning',
      title: `New ${d.severity_level || 'high'}-severity incident`,
      text: `${formatIncidentTypesLabel(d)} in ${d.barangay || 'your area'}`,
    });
    clearLastHighSeverity();
  }, [lastHighSeverity, clearLastHighSeverity]);

  useEffect(() => {
    if (!lastDispatched?.data) return;
    const roleNow = normalizeRole(getStoredUser().role);
    const isDept = [ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PERSONNEL].includes(roleNow);
    if (!isDept) return;
    const d = lastDispatched.data;
    const reportId = d.report_id ?? d.reportId;
    toastNotice({
      icon: 'info',
      title: reportId ? `Report #${reportId} assigned to your department` : 'Report assigned to your department',
      text: `${formatIncidentTypesLabel(d)} in ${d.barangay || 'your area'}`,
    });
    clearLastDispatched();
  }, [lastDispatched, clearLastDispatched]);

  useEffect(() => {
    if (!lastBackupRequested?.data) return;
    const roleNow = normalizeRole(getStoredUser().role);
    const isDept = [ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PERSONNEL].includes(roleNow);
    if (!isDept) return;
    const d = lastBackupRequested.data;
    const reportId = d.report_id ?? d.reportId;
    const requester = d.requested_by_name ? ` from ${d.requested_by_name}` : '';
    toastNotice({
      icon: 'warning',
      title: reportId ? `Backup needed — Report #${reportId}` : 'Backup needed',
      text: `${formatIncidentTypesLabel(d)}${requester}${d.barangay ? ` in ${d.barangay}` : ''}`,
      timer: 6000,
    });
    clearLastBackupRequested();
  }, [lastBackupRequested, clearLastBackupRequested]);

  useEffect(() => {
    if (!lastBackupJoined?.data) return;
    const d = lastBackupJoined.data;
    const reportId = d.report_id ?? d.reportId;
    const joinerName = d.volunteer_name || 'A volunteer';
    toastNotice({
      icon: 'info',
      title: reportId ? `Backup volunteer joined — Report #${reportId}` : 'Backup volunteer joined',
      text: `${joinerName} joined as backup${d.responder_status ? ` (${d.responder_status})` : ''}`,
    });
    clearLastBackupJoined();
  }, [lastBackupJoined, clearLastBackupJoined]);

  useEffect(() => {
    if (!lastEscalated?.data) return;
    const { eventName, data } = lastEscalated;
    const reportId = data.report_id ?? data.reportId;
    const isEscalationRequest = eventName === 'incident:escalated';
    const toDept = data.to_department_name || (data.to_department_id ? `Department #${data.to_department_id}` : '');
    toastNotice({
      icon: isEscalationRequest ? 'warning' : 'info',
      title: isEscalationRequest
        ? (reportId ? `Help requested — Report #${reportId}` : 'Help requested')
        : (reportId ? `Help update — Report #${reportId}` : 'Help update'),
      text: toDept
        ? `${isEscalationRequest ? 'Requested from' : 'Status with'} ${toDept}${data.urgency ? ` (${data.urgency})` : ''}`
        : (data.barangay ? `In ${data.barangay}` : 'Help update received'),
      timer: 6000,
    });
    clearLastEscalated();
  }, [lastEscalated, clearLastEscalated]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const storedUser = getStoredUser();
  const currentUser = storedUser.role ? storedUser : {
    username: 'Super Admin',
    email: 'admin@rescuelink.dagupan.gov.ph',
    role: ROLES.SUPER_ADMIN,
    department: 'All',
  };
  const role = normalizeRole(currentUser.role);

  const notifications = apiNotifications.map(mapApiToUi);

  const handleNotificationClick = async (notification) => {
    if (notification.notificationId && notification.unread) {
      setApiNotifications((prev) => prev.map((item) => (
        item.notification_id === notification.notificationId
          ? { ...item, is_read: true }
          : item
      )));
      setApiUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationAsRead(notification.notificationId);
      } catch (_) {
        fetchApiNotifications();
      }
    }

    if (notification.reportId) navigate(`/incidents/${notification.reportId}`);
    setNotificationsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setApiNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setApiUnreadCount(0);
      clearNotifications();
    } catch (_) {
      fetchApiNotifications();
    }
  };

  const userName = currentUser.name ||
    ([currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || null) ||
    currentUser.username ||
    currentUser.email ||
    'Officer Munar';
  const userRoleLabel = role === ROLES.SUPER_ADMIN
    ? 'Super Admin'
    : role === ROLES.DISPATCHER
      ? 'Dispatcher'
      : role === ROLES.DEPARTMENT_ADMIN
        ? 'Dept Admin'
        : role === ROLES.DEPARTMENT_HEAD
          ? 'Dept Head'
          : 'Personnel';
  const userRole = currentUser.role ? userRoleLabel : (currentUser.role || 'Operator');

  const performLogout = async () => {
    try {
      await logoutApi();
    } catch (_) {}
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Firebase signOut error:', err);
    }
    clearAuthSession();
    alertUser({
      icon: 'success',
      title: 'Logged out',
      text: 'You have been successfully logged out.',
      timer: 1500,
      showConfirmButton: false,
    });
    navigate('/login');
  };

  const handleLogout = () => {
    alertUser({
      title: 'Log out?',
      text: 'Are you sure you want to log out of RescueLink?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) performLogout();
    });
  };

  const getNavSections = () => {
    if (role === ROLES.DISPATCHER) return NAV_DISPATCHER;
    if (role === ROLES.DEPARTMENT_HEAD) return NAV_DEPARTMENT_HEAD;
    if (role === ROLES.DEPARTMENT_ADMIN) return NAV_DEPARTMENT_ADMIN;
    if (role === ROLES.PERSONNEL) return NAV_PERSONNEL;
    return NAV_SUPER_ADMIN;
  };
  const sections = getNavSections();
  const siderTheme = isLight ? 'light' : 'dark';

  const notificationIcon = (type) => {
    const Icon = type === 'alert' ? AlertCircle : type === 'success' ? CheckCircle : Info;
    return <Icon size={16} />;
  };

  const border = shellBorderColor(isLight);

  return (
    <AntLayout style={{ height: '100%', overflow: 'hidden' }}>
      <Sider
        collapsible
        collapsed={isCollapsed}
        onCollapse={setIsCollapsed}
        trigger={null}
        width={256}
        collapsedWidth={80}
        theme={siderTheme}
        style={{ height: '100%', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: isCollapsed ? 2 : 8,
            flexShrink: 0,
            boxSizing: 'border-box',
            height: 64,
            padding: isCollapsed ? '0 4px' : '0 12px 0 16px',
          }}>
            <BrandLogo iconOnly={isCollapsed} size={isCollapsed ? 'md' : 'lg'} />
            <Button
              type="text"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              icon={isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
              onClick={() => setIsCollapsed((value) => !value)}
              style={{ flexShrink: 0 }}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {DEV_MODE && (
              <div style={{ padding: '0 12px 8px' }}>
                <label htmlFor="dev-role-switcher" className="sr-only">Switch role (dev)</label>
                <Select
                  id="dev-role-switcher"
                  value={role}
                  aria-label="Switch role (dev)"
                  onChange={(value) => {
                    const preset = DEV_ROLE_PRESETS.find((p) => p.value === value);
                    if (!preset) return;
                    persistAuthUser(preset.user);
                    navigate(getDefaultRouteByRole(preset.value));
                  }}
                  options={DEV_ROLE_PRESETS.map((p) => ({
                    value: p.value,
                    label: isCollapsed ? p.label.split(' ')[0] : p.label,
                  }))}
                  style={{ width: '100%' }}
                  size="small"
                  popupMatchSelectWidth={false}
                />
              </div>
            )}
            <Menu
              mode="inline"
              theme={siderTheme}
              selectedKeys={activeMenuKey(location.pathname, sections)}
              items={menuItemsFor(sections, isCollapsed)}
              onClick={({ key }) => {
                if (key === 'logout') {
                  handleLogout();
                  return;
                }
                navigate(key);
              }}
            />
          </div>
        </div>
      </Sider>

      <AntLayout
        style={{
          height: '100%',
          overflow: 'hidden',
          borderLeft: `1px solid ${border}`,
          boxSizing: 'border-box',
        }}
      >
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 16px',
          height: 64,
          lineHeight: 'normal',
          flexShrink: 0,
          boxSizing: 'border-box',
          borderBottom: `1px solid ${border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <GlobalSearch />
          </div>
          <ThemeToggle />
          <Popover
            open={notificationsOpen}
            onOpenChange={(open) => {
              setNotificationsOpen(open);
              if (open) void handleMarkAllAsRead();
            }}
            trigger="click"
            placement="bottomRight"
            content={(
              <div style={{ width: 360, maxWidth: '70vw' }}>
                <List
                  size="small"
                  dataSource={notifications}
                  locale={{ emptyText: notificationsAuthError || 'No new notifications' }}
                  style={{ maxHeight: 320, overflow: 'auto' }}
                  renderItem={(n) => (
                    <List.Item
                      style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <span style={{ marginRight: 8, marginTop: 4 }}>{notificationIcon(n.type)}</span>
                      <List.Item.Meta
                        title={n.title}
                        description={<span>{n.body}<br />{n.time}</span>}
                      />
                    </List.Item>
                  )}
                />
                {notifications.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button type="link" size="small" onClick={handleMarkAllAsRead}>Mark all as read</Button>
                    <Button type="link" size="small" onClick={() => { clearNotifications(); setNotificationsOpen(false); }}>Clear</Button>
                  </div>
                )}
              </div>
            )}
          >
            <Badge count={apiUnreadCount} size="small" offset={[-4, 6]}>
              <Button
                type="text"
                aria-label="Notifications"
                title={wsStatus === 'connected' ? 'Live updates connected' : 'Notifications'}
                icon={<Bell size={18} />}
              />
            </Badge>
          </Popover>
          <Dropdown
            menu={{
              items: [
                { key: 'help', icon: <HelpCircle size={16} />, label: 'Help & Support' },
                { key: 'logout', icon: <LogOut size={16} />, label: 'Log out' },
              ],
              onClick: ({ key }) => {
                if (key === 'logout') handleLogout();
                else navigate('/help');
              },
            }}
            trigger={['click']}
          >
            <Button type="text" aria-haspopup="true" style={{ height: 'auto', padding: '4px 8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <ProfileAvatar
                  firstName={currentUser.firstName}
                  lastName={currentUser.lastName}
                  photoUrl={headerAvatarUrl}
                  size="sm"
                />
                <span style={{ textAlign: 'left', lineHeight: 1.2 }} className="hidden sm:block">
                  <span style={{ display: 'block', fontSize: 14 }}>{userName}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>{userRole}</span>
                </span>
              </span>
            </Button>
          </Dropdown>
        </Header>
        <NotificationPromptBanner />
        <Content style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
