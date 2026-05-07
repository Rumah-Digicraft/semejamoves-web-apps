import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Dumbbell, Trophy, Circle, TrendingUp, CalendarDays, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SportConfig } from '../types';
import { formatCurrency } from '../utils/format';

export default function Dashboard() {
  const navigate = useNavigate();
  const [sports, setSports] = useState<SportConfig[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalIncome: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      // Load sports config
      const { data: sportsData } = await supabase
        .from('sports_config')
        .select('*');
      
      if (sportsData) setSports(sportsData);

      // Current month stats
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: sessionCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('session_date', startOfMonth.toISOString());

      const { data: incomeData } = await supabase
        .from('cashflow_entries')
        .select('amount')
        .eq('category', 'income')
        .gte('entry_date', startOfMonth.toISOString());

      const totalIncome = incomeData?.reduce((sum, item) => sum + item.amount, 0) || 0;

      setStats({
        totalSessions: sessionCount || 0,
        totalIncome,
      });

      setLoading(false);
    }

    loadDashboard();
  }, []);

  const renderIcon = (name: string, className: string = '') => {
    switch (name) {
      case 'Dumbbell': return <Dumbbell className={className} />;
      case 'Trophy': return <Trophy className={className} />;
      case 'Circle': return <Circle className={className} />;
      default: return <Activity className={className} />;
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm md:text-base text-gray-500 mt-2">Overview of all active sports and operational metrics.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Sessions This Month</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Income This Month</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalIncome)}</p>
          </div>
        </div>
      </div>

      {/* Sports Grid */}
      <h2 className="text-xl font-bold text-gray-900 mb-6">Sports Operations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sports.map((sport) => {
          const isActive = sport.is_active;

          return (
            <div
              key={sport.sport_type}
              onClick={() => isActive && navigate(`/${sport.sport_type}`)}
              className={`relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 ${
                isActive 
                  ? 'bg-white border-gray-100 hover:shadow-lg hover:-translate-y-1 cursor-pointer group' 
                  : 'bg-gray-50 border-gray-200 cursor-not-allowed grayscale'
              }`}
            >
              {!isActive && (
                <div className="absolute top-4 right-4 text-gray-400">
                  <Lock size={20} />
                </div>
              )}
              
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: isActive ? `${sport.color}15` : '#e5e7eb', color: isActive ? sport.color : '#9ca3af' }}
              >
                {renderIcon(sport.icon, "w-7 h-7")}
              </div>
              
              <h3 className={`text-lg font-bold mb-1 ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                {sport.name}
              </h3>
              
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Default Price</span>
                <span className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {formatCurrency(sport.default_price)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
