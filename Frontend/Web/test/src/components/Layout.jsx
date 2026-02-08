import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, AlertTriangle, Map, User, FileText, Settings, Shield, Building2, LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import Swal from 'sweetalert2';
import { useTheme } from '../context/ThemeContext.jsx';
import { ThemeToggle } from './ThemeToggle';

const SIDEBAR_STORAGE_KEY = 'rescuelink_sidebar_collapsed';

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
  const navRef = useRef(null);
  const linkRefs = useRef({});
  const [navIndicator, setNavIndicator] = useState({ top: 0, height: 0 });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useLayoutEffect(() => {
    const activePath = location.pathname;
    // Defer measurement to next frame so refs and layout are stable after navigation
    const rafId = requestAnimationFrame(() => {
      const activeLink = linkRefs.current[activePath];
      if (activeLink && navRef.current && activeLink.isConnected) {
        setNavIndicator({
          top: activeLink.offsetTop,
          height: activeLink.offsetHeight,
        });
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [location.pathname, isCollapsed]);
  
  // Get current user role - set default for design mode
  const currentUser = JSON.parse(localStorage.getItem('user') || JSON.stringify({
    username: 'Officer Munar',
    email: 'designer@rescuelink.com',
    role: 'Operator',
    department: 'All'
  }));
  const isAdmin = currentUser.role === 'Admin';

  // Get user display name
  const userName = currentUser.username || currentUser.name || 'Officer Munar';
  const userRole = currentUser.role || 'Operator';

  const performLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
      Swal.fire({
        icon: 'success',
        title: 'Logged out',
        text: 'You have been successfully logged out.',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
      Swal.fire({
        icon: 'info',
        title: 'Logged out',
        text: 'You have been logged out.',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    }
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
      if (result.isConfirmed) {
        performLogout();
      }
    });
  };

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Map, label: 'Map View', path: '/map' },
    { icon: Building2, label: 'Departments', path: '/departments' },
    { icon: LayoutDashboard, label: 'Task Board', path: '/taskboard' },
    { icon: FileText, label: 'Audit Log', path: '/audit' },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];
  
  // Add Admin Actions for admin users (before Profile so Profile appears below)
  if (isAdmin) {
    menuItems.splice(5, 0, { icon: Shield, label: 'Admin Actions', path: '/adminactions' });
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`flex flex-col shadow-card overflow-hidden transition-[width] duration-300 ease-in-out border-r border-border ${
          isLight ? 'bg-white' : 'bg-secondary'
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        <div className={`border-b border-border flex items-center transition-all duration-300 ease-in-out ${
          isCollapsed ? 'p-3 flex-col gap-2 pl-4' : 'p-5 pl-6'
        }`}>
          <div className={`flex items-center w-full transition-all duration-300 ease-in-out ${
            isCollapsed ? 'flex-col gap-2' : 'gap-2'
          }`}>
            <img
              src={isLight ? logo : logoDark}
              alt="RescueLink Logo"
              className={`flex-shrink-0 transition-[height] duration-300 ease-in-out hover:scale-105 ${
                isCollapsed ? 'h-8 w-auto' : 'h-16 w-auto'
              }`}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 focus:ring-2 focus:ring-offset-2 ${
                isLight
                  ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 focus:ring-gray-300 focus:ring-offset-white'
                  : 'hover:bg-secondary-hover text-foreground/80 hover:text-foreground focus:ring-foreground/30 focus:ring-offset-secondary'
              }`}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav ref={navRef} className="relative flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Sliding active indicator – only top animates for a clean slide */}
          <div
            className="absolute left-2 right-2 rounded-xl bg-primary/20 pointer-events-none"
            style={{
              top: navIndicator.top,
              height: navIndicator.height,
              transition: 'top 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                ref={(el) => { linkRefs.current[item.path] = el; }}
                to={item.path}
                title={item.label}
                className={`relative z-10 flex items-center rounded-xl transition-all duration-300 ease-in-out group overflow-hidden ${
                  isCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
                } ${
                  isActive
                    ? 'text-primary'
                    : isLight
                      ? 'text-gray-700 hover:bg-gray-100 hover:translate-x-1 active:bg-gray-200'
                      : 'text-foreground/90 hover:bg-[rgba(19,65,120,0.5)] hover:translate-x-1 active:bg-[rgba(19,65,120,0.6)]'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ease-in-out ${isActive ? '' : 'group-hover:scale-110'}`} />
                {!isCollapsed && <span className="font-medium whitespace-nowrap transition-opacity duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className={`border-t border-border transition-all duration-300 ease-in-out ${
          isLight ? 'bg-gray-50' : 'bg-background/40'
        } ${isCollapsed ? 'p-3' : 'p-4'}`}>
          <div className={`flex items-center rounded-xl bg-card shadow-card hover:shadow-card-hover border border-border transition-all duration-300 ease-in-out ${
            isCollapsed ? 'justify-center p-2 mb-3' : 'gap-3 mb-4 p-3'
          }`}>
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center flex-shrink-0 shadow-md transition-transform duration-300 hover:scale-110">
              <User className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{userName}</p>
                <p className="text-xs text-muted truncate">{userRole}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center justify-center border-2 border-primary/50 rounded-xl bg-card hover:bg-primary/10 hover:border-primary/70 transition-all duration-300 ease-in-out text-primary font-medium transform hover:scale-105 active:scale-95 shadow-card hover:shadow-card-hover focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
              isCollapsed ? 'w-full p-2' : 'w-full gap-2 px-4 py-2'
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0 transition-transform duration-300 hover:rotate-12" />
            {!isCollapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background relative">
        <div className="absolute top-8 right-8 z-10">
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  );
}
