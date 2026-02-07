import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, AlertTriangle, Map, User, FileText, Settings, Shield, Building2, LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logo.svg';
import Swal from 'sweetalert2';

const SIDEBAR_STORAGE_KEY = 'rescuelink_sidebar_collapsed';

export function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? 'false');
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);
  
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
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col shadow-lg overflow-hidden transition-[width] duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`border-b border-gray-200 flex items-center transition-all duration-300 ease-in-out ${
          isCollapsed ? 'p-3 flex-col gap-2' : 'p-6'
        }`}>
          <div className={`flex items-center w-full transition-all duration-300 ease-in-out ${
            isCollapsed ? 'flex-col gap-2' : 'gap-3'
          }`}>
            <img
              src={logo}
              alt="RescueLink Logo"
              className={`flex-shrink-0 transition-[height] duration-300 ease-in-out hover:scale-105 ${
                isCollapsed ? 'h-10 w-auto' : 'h-20 w-auto'
              }`}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex items-center rounded-xl transition-all duration-300 ease-in-out group overflow-hidden ${
                  isCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
                } ${
                  isActive
                    ? 'bg-[#FFEBEE] text-[#FF5052]'
                    : 'text-gray-700 hover:bg-gray-100 hover:translate-x-1'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ease-in-out ${isActive ? '' : 'group-hover:scale-110'}`} />
                {!isCollapsed && <span className="font-medium whitespace-nowrap transition-opacity duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className={`border-t border-gray-200 bg-gray-50 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'p-3' : 'p-4'
        }`}>
          <div className={`flex items-center rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-300 ease-in-out ${
            isCollapsed ? 'justify-center p-2 mb-3' : 'gap-3 mb-4 p-3'
          }`}>
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF4F52] to-[#E63946] rounded-full flex items-center justify-center flex-shrink-0 shadow-md transition-transform duration-300 hover:scale-110">
              <User className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userRole}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center justify-center border-2 border-red-300 rounded-xl bg-white hover:bg-red-50 hover:border-red-400 transition-all duration-300 ease-in-out text-red-600 font-medium transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md ${
              isCollapsed ? 'w-full p-2' : 'w-full gap-2 px-4 py-2'
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0 transition-transform duration-300 hover:rotate-12" />
            {!isCollapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-white">
        {children}
      </main>
    </div>
  );
}
