import { useState, useEffect, useRef, useCallback } from 'react';
import { useIncidentWebSocket } from '@/data/api/useIncidentWebSocket';
import { getNotifications, getUnreadCount, markAllAsRead, markNotificationAsRead } from '@/data/api/notifications.api';
import { IncidentWebSocketContext } from '@/presentation/context/IncidentWebSocketContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Map, User, FileText, Settings, Shield, ShieldCheck, Building2, LogOut, PanelLeftClose, PanelLeft, Bell, HelpCircle, ChevronDown, AlertCircle, CheckCircle, Info, X, Users, Truck, ClipboardList, UserCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/infrastructure/firebase';
import { logout as logoutApi, fetchAvatarBlob } from '@/data/api/auth.api';
import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import { ProfileAvatar } from '@/presentation/components/common/ProfileAvatar';
import { GlobalSearch } from '@/presentation/components/common/GlobalSearch';
import Swal from 'sweetalert2';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { ThemeToggle } from '@/presentation/components/common/ThemeToggle';
import { getDefaultRouteByRole, ROLES, normalizeRole } from '@/core/constants';
import { DEV_MODE } from '@/core/config/app.config';
import { clearAuthSession } from '@/core/auth/session';
import { formatIncidentTypesLabel } from '@/core/utils/incidentDisplay';
import { NotificationPromptBanner } from '@/presentation/components/common/NotificationPromptBanner';

const SIDEBAR_STORAGE_KEY = 'rescuelink_sidebar_collapsed';
const APP_BAR_HEIGHT = 'h-20';

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

// Dev-only: switch role without re-login (uses preset users)
const DEV_ROLE_PRESETS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin', user: { name: 'Super Admin', username: 'Super Admin', email: 'admin@rescuelink.dagupan.gov.ph', role: ROLES.SUPER_ADMIN, department: 'All', departmentId: null } },
  { value: ROLES.DISPATCHER, label: 'Dispatcher', user: { name: 'Dispatcher Cruz', username: 'Dispatcher Cruz', email: 'dispatcher@rescuelink.dagupan.gov.ph', role: ROLES.DISPATCHER, department: 'Operations', departmentId: null } },
  { value: ROLES.DEPARTMENT_HEAD, label: 'Dept Head', user: { name: 'Dept Head', username: 'Dept Head', email: 'head@dept.dagupan.gov', role: ROLES.DEPARTMENT_HEAD, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 1 } },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Dept Admin (Fire)', user: { name: 'Fire Chief Mendoza', username: 'Fire Chief Mendoza', email: 'mendoza@fire.dagupan.gov', role: ROLES.DEPARTMENT_ADMIN, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 'bfp' } },
  { value: ROLES.PERSONNEL, label: 'Personnel (Fire)', user: { name: 'Officer Pedro Ramos', username: 'Officer Pedro Ramos', email: 'pedro.ramos@pnp.dagupan.gov', role: ROLES.PERSONNEL, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 'bfp' } },
];

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsAuthError, setNotificationsAuthError] = useState(null);
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  const notificationRefreshRef = useRef(null);

  const { status: wsStatus, clearNotifications, lastHighSeverity, clearLastHighSeverity, lastDispatched, clearLastDispatched, lastBackupRequested, clearLastBackupRequested, lastBackupJoined, clearLastBackupJoined, lastEscalated, clearLastEscalated } = useIncidentWebSocket();
  const [apiNotifications, setApiNotifications] = useState([]);
  const [apiUnreadCount, setApiUnreadCount] = useState(0);

  const fetchApiNotifications = useCallback(async () => {
    const token = sessionStorage.getItem('token');
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
      const token = sessionStorage.getItem('token');
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
    const onProfileUpdated = () => loadHeaderAvatar();
    window.addEventListener('profile-updated', onProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('profile-updated', onProfileUpdated);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    if (notificationsOpen) {
      fetchApiNotifications();
    }
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
    const title = `New ${d.severity_level || 'high'}-severity incident`;
    const body = `${formatIncidentTypesLabel(d)} in ${d.barangay || 'your area'}`;
    Swal.fire({
      icon: 'warning',
      title,
      text: body,
      timer: 5000,
      showConfirmButton: true,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
    });
    clearLastHighSeverity();
  }, [lastHighSeverity]);

  useEffect(() => {
    if (!lastDispatched?.data) return;
    const roleNow = normalizeRole((JSON.parse(sessionStorage.getItem('user') || '{}') || {}).role);
    const isDept = [ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PERSONNEL].includes(roleNow);
    if (!isDept) return;
    const d = lastDispatched.data;
    const reportId = d.report_id ?? d.reportId;
    const title = reportId ? `Incident #${reportId} assigned to your department` : 'Incident assigned to your department';
    const body = `${formatIncidentTypesLabel(d)} in ${d.barangay || 'your area'}`;
    Swal.fire({
      icon: 'info',
      title,
      text: body,
      timer: 5000,
      showConfirmButton: true,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
    });
    clearLastDispatched();
  }, [lastDispatched]);

  useEffect(() => {
    if (!lastBackupRequested?.data) return;
    const roleNow = normalizeRole((JSON.parse(sessionStorage.getItem('user') || '{}') || {}).role);
    const isDept = [ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PERSONNEL].includes(roleNow);
    if (!isDept) return;
    const d = lastBackupRequested.data;
    const reportId = d.report_id ?? d.reportId;
    const requester = d.requested_by_name ? ` from ${d.requested_by_name}` : '';
    const title = reportId ? `Backup requested — Incident #${reportId}` : 'Backup requested';
    const body = `${formatIncidentTypesLabel(d)}${requester}${d.barangay ? ` in ${d.barangay}` : ''}`;
    Swal.fire({
      icon: 'warning',
      title,
      text: body,
      timer: 6000,
      showConfirmButton: true,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
    });
    clearLastBackupRequested();
  }, [lastBackupRequested, clearLastBackupRequested]);

  useEffect(() => {
    if (!lastBackupJoined?.data) return;
    const d = lastBackupJoined.data;
    const reportId = d.report_id ?? d.reportId;
    const joinerName = d.volunteer_name || 'A volunteer';
    const title = reportId ? `Backup volunteer joined — Incident #${reportId}` : 'Backup volunteer joined';
    const body = `${joinerName} joined as backup${d.responder_status ? ` (${d.responder_status})` : ''}`;
    Swal.fire({
      icon: 'info',
      title,
      text: body,
      timer: 5000,
      showConfirmButton: true,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
    });
    clearLastBackupJoined();
  }, [lastBackupJoined, clearLastBackupJoined]);

  useEffect(() => {
    if (!lastEscalated?.data) return;
    const { eventName, data } = lastEscalated;
    const reportId = data.report_id ?? data.reportId;
    const isEscalationRequest = eventName === 'incident:escalated';
    const title = isEscalationRequest
      ? (reportId ? `Assistance Requested — Incident #${reportId}` : 'Assistance Requested')
      : (reportId ? `Assistance Update — Incident #${reportId}` : 'Assistance Update');
    const toDept = data.to_department_name || (data.to_department_id ? `Department #${data.to_department_id}` : '');
    const body = toDept
      ? `${isEscalationRequest ? 'Target:' : 'Status with'} ${toDept}${data.urgency ? ` (${data.urgency})` : ''}`
      : (data.barangay ? `In ${data.barangay}` : 'Assistance update received');

    Swal.fire({
      icon: isEscalationRequest ? 'warning' : 'info',
      title,
      text: body,
      timer: 6000,
      showConfirmButton: true,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
    });
    clearLastEscalated();
  }, [lastEscalated, clearLastEscalated]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentUser = JSON.parse(sessionStorage.getItem('user') || JSON.stringify({
    username: 'Super Admin',
    email: 'admin@rescuelink.dagupan.gov.ph',
    role: ROLES.SUPER_ADMIN,
    department: 'All'
  }));
  const role = normalizeRole(currentUser.role);
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isAdmin = isSuperAdmin; // legacy: Admin Actions / full access
  const isDeptRole = [ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PERSONNEL].includes(role);

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

    if (notification.reportId) {
      navigate(`/incidents/${notification.reportId}`);
    }
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

  const handleDevRoleChange = (e) => {
    const value = e.target.value;
    const preset = DEV_ROLE_PRESETS.find((p) => p.value === value);
    if (!preset) return;
      sessionStorage.setItem('user', JSON.stringify(preset.user));
    navigate(getDefaultRouteByRole(preset.value));
  };

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
    navigate('/login');
    Swal.fire({
      icon: 'success',
      title: 'Logged out',
      text: 'You have been successfully logged out.',
      timer: 1500,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  };

  const handleLogout = () => {
    Swal.fire({
      title: 'Log out?',
      text: 'Are you sure you want to log out of RescueLink?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
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

  const linkClasses = (isActive) => {
    const base = 'flex items-center min-h-[40px] rounded-xl transition-all duration-200 group overflow-hidden w-full';
    const size = isCollapsed ? 'justify-center px-3 py-2.5' : 'gap-3 px-3 py-2.5';
    const activeLight = 'bg-primary/15 text-primary shadow-sm';
    const activeDark = 'bg-primary/20 text-primary shadow-sm';
    const inactiveLight = 'text-gray-700 hover:bg-gray-100/80';
    const inactiveDark = 'text-foreground/90 hover:bg-white/10';
    const active = isActive ? (isLight ? activeLight : activeDark) : (isLight ? inactiveLight : inactiveDark);
    return `${base} ${size} ${active}`;
  };

  return (
    <IncidentWebSocketContext.Provider value={{ status: wsStatus, isConnected: wsStatus === 'connected' }}>
    <div className="flex min-h-screen h-full flex-1 bg-background">
      <aside
        className={`flex flex-col overflow-hidden transition-[width] duration-300 ease-out border-r border-border border-l-2 border-l-primary/40 shadow-sm ${
          isLight ? 'bg-white' : 'bg-secondary'
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Header: logo + collapse */}
        <div className={`flex items-center shrink-0 border-b border-border/80 transition-all duration-300 ${APP_BAR_HEIGHT} ${
          isLight ? 'bg-white' : 'bg-secondary'
        } ${isCollapsed ? 'justify-center px-4' : 'gap-3 px-5'}`}>
          <BrandLogo iconOnly={isCollapsed} size={isCollapsed ? 'md' : 'lg'} />
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className={`ml-auto p-2 rounded-xl transition-all duration-200 flex-shrink-0 focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ${
                isLight
                  ? 'hover:bg-gray-100 text-gray-500 focus:ring-primary/30'
                  : 'hover:bg-white/10 text-foreground/80 focus:ring-primary/40'
              }`}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center px-2 py-1">
            <button
              onClick={() => setIsCollapsed(false)}
              className={`flex items-center justify-center w-full min-h-[44px] rounded-xl transition-all duration-200 ${
                isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-foreground/80'
              }`}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeft className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
            </button>
          </div>
        )}

        <nav className="flex-1 flex flex-col min-h-0 py-4 px-3">
          <div className="flex-1 overflow-y-auto space-y-6">
            {sections.map((section) => (
              <div key={section.title}>
                {!isCollapsed && (
                  <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {section.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={item.label}
                        className={linkClasses(isActive)}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom: Dev role switcher, Help & Support, Log out */}
          <div className="flex-shrink-0 pt-4 mt-4 border-t border-border/80 space-y-0.5">
            {DEV_MODE && (
              <div className={`px-3 py-2 ${!isCollapsed ? 'mb-2' : ''}`}>
                <label htmlFor="dev-role-switcher" className="sr-only">Switch role (dev)</label>
                <select
                  id="dev-role-switcher"
                  value={role}
                  onChange={handleDevRoleChange}
                  title="Switch role (dev only)"
                  className={`w-full rounded-lg border bg-transparent text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isCollapsed
                      ? 'px-2 py-1.5 border-amber-500/50 text-amber-600 dark:text-amber-400'
                      : 'px-3 py-2 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {DEV_ROLE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{isCollapsed ? p.label.split(' ')[0] : p.label}</option>
                  ))}
                </select>
                {!isCollapsed && (
                  <p className="text-[10px] text-muted mt-1 px-0.5">Dev: switch role</p>
                )}
              </div>
            )}
            <Link
              to="/help"
              title="Help & Support"
              className={linkClasses(location.pathname === '/help')}
            >
              <HelpCircle className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Help & Support</span>}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              className={`w-full ${linkClasses(false)} ${isLight ? 'text-gray-700' : 'text-foreground/90'}`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Log out</span>}
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header: search (left), notifications + profile (right) */}
        <header className={`flex-shrink-0 flex items-center gap-4 px-6 border-b border-border/80 shadow-sm ${APP_BAR_HEIGHT} ${
          isLight ? 'bg-white' : 'bg-card'
        }`}>
          <GlobalSearch />

          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((o) => !o)}
                className={`relative p-2 rounded-xl transition-all duration-200 ${
                  isLight ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-foreground/80'
                } ${notificationsOpen ? (isLight ? 'bg-gray-100' : 'bg-white/10') : ''}`}
                aria-label="Notifications"
                title="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="w-5 h-5" strokeWidth={2} />
                {apiUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground flex items-center justify-center" aria-hidden>
                    {Math.min(apiUnreadCount, 99)}
                  </span>
                )}
                {wsStatus === 'connected' && (
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500" title="Live updates connected" aria-hidden />
                )}
              </button>
              {notificationsOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] z-[100] rounded-2xl border shadow-xl overflow-hidden ${
                    isLight
                      ? 'glass neumorphic-light bg-white/95 backdrop-blur-md border-gray-200/90 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)]'
                      : 'glass neumorphic-dark bg-card/95 backdrop-blur-md border-white/20 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b ${
                      isLight ? 'bg-gray-50/80 border-gray-200/80' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
                        }`}
                      >
                        <Bell className="w-4 h-4" strokeWidth={2} />
                      </span>
                      <span className="font-semibold text-foreground text-sm">Notifications</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isLight ? 'hover:bg-gray-200/80 text-muted' : 'hover:bg-white/20 text-muted'
                      }`}
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                  <div className={`max-h-[min(70vh,320px)] overflow-y-auto ${isLight ? 'bg-white' : 'bg-card'}`}>
                    {(notifications || []).length === 0 ? (
                      <div className="py-10 px-4 text-center">
                        <span
                          className={`inline-flex w-12 h-12 rounded-xl items-center justify-center mb-3 ${
                            isLight ? 'neumorphic-light-inset bg-gray-100 text-muted' : 'neumorphic-dark-inset bg-white/10 text-muted'
                          }`}
                        >
                          <Bell className="w-6 h-6" strokeWidth={2} />
                        </span>
                        <p className="text-sm text-muted">
                          {notificationsAuthError || 'No new notifications'}
                        </p>
                      </div>
                    ) : (
                      <ul>
                        {(notifications || []).map((n) => {
                          const Icon = n.type === 'alert' ? AlertCircle : n.type === 'success' ? CheckCircle : Info;
                          const iconBox = isLight
                            ? 'neumorphic-light-inset bg-gray-100 text-primary'
                            : 'neumorphic-dark-inset bg-white/10 text-primary';
                          return (
                            <li key={n.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNotificationClick(n)}
                                onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
                                className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer ${
                                  n.unread ? (isLight ? 'bg-primary/5' : 'bg-primary/10') : isLight ? 'hover:bg-gray-50/80' : 'hover:bg-white/5'
                                }`}
                              >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBox}`}>
                                  <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>
                                  <p className="text-xs text-muted mt-1">{n.time}</p>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {(notifications || []).length > 0 && (
                    <div
                      className={`px-4 py-2.5 border-t flex justify-between items-center ${
                        isLight ? 'bg-gray-50/90 border-gray-200' : 'bg-white/[0.03] border-white/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Mark all as read
                      </button>
                      <button
                        type="button"
                        onClick={() => { clearNotifications(); setNotificationsOpen(false); }}
                        className="text-xs font-medium text-muted hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 ${
                  isLight ? 'hover:bg-gray-100' : 'hover:bg-white/10'
                }`}
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <ProfileAvatar
                  firstName={currentUser.firstName}
                  lastName={currentUser.lastName}
                  photoUrl={headerAvatarUrl}
                  size="sm"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-foreground leading-tight">{userName}</p>
                  <p className="text-xs text-muted leading-tight">{userRole}</p>
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className={`absolute right-0 top-full mt-2 min-w-[220px] rounded-xl border shadow-lg py-1.5 z-50 ${
                  isLight ? 'bg-white border-gray-200' : 'bg-card border-border'
                }`}>
                  <Link
                    to="/help"
                    onClick={() => setProfileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg mx-1 transition-colors ${
                      isLight ? 'text-gray-700 hover:bg-gray-50' : 'text-foreground hover:bg-white/10'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/30">
                      <HelpCircle className="w-4 h-4" />
                    </span>
                    Help & Support
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); handleLogout(); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg mx-1 transition-colors ${
                      isLight ? 'text-gray-700 hover:bg-gray-50' : 'text-foreground hover:bg-white/10'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/30">
                      <LogOut className="w-4 h-4" />
                    </span>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <NotificationPromptBanner />

        <main className="flex-1 overflow-auto bg-background relative">
          {children}
        </main>
      </div>
    </div>
    </IncidentWebSocketContext.Provider>
  );
}
