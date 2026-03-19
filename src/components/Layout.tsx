import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ClipboardList, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  Sprout
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF', 'ENCODER', 'VIEWER'] },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['ADMIN', 'STAFF', 'ENCODER', 'VIEWER'] },
    { name: 'Recipients', path: '/recipients', icon: Users, roles: ['ADMIN', 'STAFF', 'ENCODER', 'VIEWER'] },
    { name: 'Distribute', path: '/distribute', icon: ClipboardList, roles: ['ADMIN', 'STAFF', 'ENCODER'] },
    { name: 'Distribution Log', path: '/logs', icon: FileText, roles: ['ADMIN', 'STAFF', 'ENCODER', 'VIEWER'] },
    { name: 'Reports', path: '/reports', icon: FileText, roles: ['ADMIN', 'STAFF', 'VIEWER'] },
    { name: 'User Management', path: '/users', icon: Settings, roles: ['ADMIN'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role as string));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-emerald-800 text-white transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-4 bg-emerald-900">
          <div className="flex items-center space-x-2">
            <Sprout className="w-8 h-8 text-emerald-400" />
            <span className="text-lg font-bold">MAO RSBSA</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-300 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-6 px-2">
            <p className="text-sm font-medium text-emerald-200">Welcome,</p>
            <p className="font-semibold truncate">{user?.name || user?.email}</p>
            <p className="text-xs text-emerald-300 mt-1 uppercase bg-emerald-900/50 inline-block px-2 py-0.5 rounded">{user?.role}</p>
          </div>

          <nav className="space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center px-2 py-2.5 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-emerald-700 text-white" 
                    : "text-emerald-100 hover:bg-emerald-700/50 hover:text-white"
                )}
                onClick={() => setIsSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 w-full p-4 border-t border-emerald-700">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-emerald-100 rounded-md hover:bg-emerald-700/50 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm lg:hidden">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sprout className="w-6 h-6 text-emerald-600" />
              <span className="text-lg font-bold text-gray-900">MAO RSBSA</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
