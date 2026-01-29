import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, AlertTriangle, Map, User, FileText, Settings, Shield, Building2, LayoutDashboard, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logo.svg';

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      // Even if Firebase logout fails, clear local data and navigate
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    }
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
  
  // Add Admin Actions for admin users
  if (isAdmin) {
    menuItems.splice(6, 0, { icon: Shield, label: 'Admin Actions', path: '/adminactions' });
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="RescueLink Logo" 
              className="h-20 w-auto transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-[#FFEBEE] text-[#FF5052]'
                    : 'text-gray-700 hover:bg-gray-100 hover:translate-x-1'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-300">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF4F52] to-[#E63946] rounded-full flex items-center justify-center flex-shrink-0 shadow-md transition-transform duration-300 hover:scale-110">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{userRole}</p>
            </div>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-red-300 rounded-xl bg-white hover:bg-red-50 hover:border-red-400 transition-all duration-300 text-red-600 font-medium transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          >
            <LogOut className="w-4 h-4 transition-transform duration-300 hover:rotate-12" />
            <span className="text-sm">Logout</span>
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
