import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Trophy, Wallet, LogOut, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MainLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/lapkeu', icon: <Wallet size={20} />, label: 'Laporan Keuangan' },
    { to: '/funminton', icon: <Dumbbell size={20} />, label: 'Funminton' },
    { to: '/padel', icon: <Trophy size={20} />, label: 'Padel' },
  ];

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-primary-navy flex items-center justify-between px-4 z-20 shadow-md">
        <h1 className="text-xl font-bold tracking-wider text-white">SEMEJA<span className="text-primary-amber">MOVES</span></h1>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="text-white p-2">
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-primary-navy text-white flex flex-col z-40 transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 hidden lg:block">
          <h1 className="text-2xl font-bold tracking-wider">SEMEJA<span className="text-primary-amber">MOVES</span></h1>
          <p className="text-xs text-gray-400 mt-1">Internal Operations</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 lg:mt-4 mt-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-primary-purple text-white font-medium shadow-md' 
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
