import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Map, User, FileText, Settings, Shield, ShieldCheck, Building2, LogOut, PanelLeftClose, PanelLeft, Search, Bell, HelpCircle, ChevronDown, AlertCircle, CheckCircle, Info, X, Users, Truck, ClipboardList } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/infrastructure/firebase';
import { logout as logoutApi } from '@/data/api/auth.api';
import logo from '@/presentation/assets/logo.svg';
import logoDark from '@/presentation/assets/logo-dark.svg';
import Swal from 'sweetalert2';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { ThemeToggle } from '@/presentation/components/common/ThemeToggle';
import { ROLES, normalizeRole } from '@/core/constants';
import { DEV_MODE } from '@/core/config/app.config';
import { clearAuthSession } from '@/core/auth/session';

const SIDEBAR_STORAGE_KEY = 'rescuelink_sidebar_collapsed';

const NAV_SUPER_ADMIN = [
  { title: 'OVERVIEW', items: [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Map, label: 'Map View', path: '/map' },
  ]},
  { title: 'OPERATIONS', items: [
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
    { icon: Truck, label: 'Vehicles', path: '/department/vehicles' },
    { icon: ClipboardList, label: 'Active Tasks', path: '/department/tasks' },
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

const NAV_DISPATCHER = [
  { title: 'OVERVIEW', items: [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Map, label: 'Map View', path: '/map' },
  ]},
  { title: 'GENERAL', items: [
    { icon: User, label: 'Profile', path: '/profile' },
  ]},
];

const NAV_DEPARTMENT_HEAD = [
  { title: 'DEPARTMENT', items: [
    { icon: Building2, label: 'Department View', path: '/department/view' },
  ]},
];

// Dev-only: switch role without re-login (uses preset users)
const DEV_ROLE_PRESETS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin', user: { name: 'Super Admin', username: 'Super Admin', email: 'admin@rescuelink.dagupan.gov.ph', role: ROLES.SUPER_ADMIN, department: 'All', departmentId: null } },
  { value: ROLES.DISPATCHER, label: 'Dispatcher', user: { name: 'Dispatcher Cruz', username: 'Dispatcher Cruz', email: 'dispatcher@rescuelink.dagupan.gov.ph', role: ROLES.DISPATCHER, department: 'Operations', departmentId: null } },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Dept Admin (Fire)', user: { name: 'Fire Chief Mendoza', username: 'Fire Chief Mendoza', email: 'mendoza@fire.dagupan.gov', role: ROLES.DEPARTMENT_ADMIN, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 'bfp' } },
  { value: ROLES.PERSONNEL, label: 'Personnel (Fire)', user: { name: 'Officer Pedro Ramos', username: 'Officer Pedro Ramos', email: 'pedro.ramos@pnp.dagupan.gov', role: ROLES.PERSONNEL, department: 'Bureau of Fire Protection (BFP Dagupan)', departmentId: 'bfp' } },
  { value: ROLES.DEPARTMENT_HEAD, label: 'Dept Head (DRRMO)', user: { name: 'Dept Head Garcia', username: 'Dept Head Garcia', email: 'garcia@drrmo.dagupan.gov', role: ROLES.DEPARTMENT_HEAD, department: 'DRRMO Dagupan', departmentId: 'drrmo' } },
];

function getRedirectPathForRole(r) {
  if (r === ROLES.DISPATCHER) return '/dashboard';
  if (r === ROLES.DEPARTMENT_ADMIN) return '/department/dashboard';
  if (r === ROLES.DEPARTMENT_HEAD) return '/department/view';
  if (r === ROLES.PERSONNEL) return '/department/tasks';
  return '/dashboard';
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);

  const mockNotifications = [
    { id: '1', type: 'alert', title: 'New incident reported', body: 'Fire incident in Barangay Poblacion', time: '2 min ago', unread: true },
    { id: '2', type: 'success', title: 'Dispatch completed', body: 'Unit BFP-01 has been assigned', time: '15 min ago', unread: true },
    { id: '3', type: 'info', title: 'System update', body: 'Scheduled maintenance tonight 2–4 AM', time: '1 hour ago', unread: false },
  ];

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

  const currentUser = JSON.parse(localStorage.getItem('user') || JSON.stringify({
    username: 'Super Admin',
    email: 'admin@rescuelink.dagupan.gov.ph',
    role: ROLES.SUPER_ADMIN,
    department: 'All'
  }));
  const role = normalizeRole(currentUser.role);
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isAdmin = isSuperAdmin; // legacy: Admin Actions / full access

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
    localStorage.setItem('user', JSON.stringify(preset.user));
    navigate(getRedirectPathForRole(preset.value));
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
    if (role === ROLES.DEPARTMENT_HEAD) return NAV_DEPARTMENT_HEAD;
    if (role === ROLES.DISPATCHER) return NAV_DISPATCHER;
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
    <div className="flex min-h-screen h-full flex-1 bg-background">
      <aside
        className={`flex flex-col overflow-hidden transition-[width] duration-300 ease-out border-r border-border border-l-2 border-l-primary/40 shadow-sm ${
          isLight ? 'bg-white' : 'bg-secondary'
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Header: logo + collapse */}
        <div className={`flex items-center border-b border-border/80 transition-all duration-300 ${
          isLight ? 'bg-white' : 'bg-secondary'
        } ${isCollapsed ? 'justify-center p-4' : 'gap-3 p-5 pl-5'}`}>
          <img
            src={isLight ? logo : logoDark}
            alt="RescueLink"
            className={`flex-shrink-0 object-contain transition-[height] duration-300 ${
              isCollapsed ? 'h-8 w-8' : 'h-12 w-auto max-h-12'
            }`}
          />
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
        <header className={`flex-shrink-0 flex items-center gap-4 px-6 py-3.5 border-b border-border/80 shadow-sm ${
          isLight ? 'bg-white' : 'bg-card'
        }`}>
          <div className="flex-1 max-w-md">
            <div className={`relative rounded-xl border transition-colors ${
              isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-background/50 border-border'
            }`}>
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isLight ? 'text-gray-400' : 'text-muted'
              }`} />
              <input
                type="search"
                placeholder="Search incidents, services, or agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-transparent text-sm outline-none ${
                  isLight ? 'text-gray-900 placeholder:text-gray-400' : 'text-foreground placeholder:text-muted'
                }`}
              />
            </div>
          </div>

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
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" aria-hidden />
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
                    {mockNotifications.length === 0 ? (
                      <div className="py-10 px-4 text-center">
                        <span
                          className={`inline-flex w-12 h-12 rounded-xl items-center justify-center mb-3 ${
                            isLight ? 'neumorphic-light-inset bg-gray-100 text-muted' : 'neumorphic-dark-inset bg-white/10 text-muted'
                          }`}
                        >
                          <Bell className="w-6 h-6" strokeWidth={2} />
                        </span>
                        <p className="text-sm text-muted">No new notifications</p>
                      </div>
                    ) : (
                      <ul>
                        {mockNotifications.map((n) => {
                          const Icon = n.type === 'alert' ? AlertCircle : n.type === 'success' ? CheckCircle : Info;
                          const iconBox = isLight
                            ? 'neumorphic-light-inset bg-gray-100 text-primary'
                            : 'neumorphic-dark-inset bg-white/10 text-primary';
                          return (
                            <li key={n.id}>
                              <div
                                className={`flex gap-3 px-4 py-3 transition-colors ${
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
                  {mockNotifications.length > 0 && (
                    <div
                      className={`px-4 py-2.5 border-t ${
                        isLight ? 'bg-gray-50/90 border-gray-200' : 'bg-white/[0.03] border-white/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Mark all as read
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
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
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

        <main className="flex-1 overflow-auto bg-background relative">
          {children}
        </main>
      </div>
    </div>
  );
}
