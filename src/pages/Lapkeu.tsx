import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CashflowEntry, Session } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Wallet, TrendingUp, TrendingDown, Activity, Plus, Trash2 } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';

export default function Lapkeu() {
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gabungan' | 'funminton' | 'padel'>('gabungan');
  
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  
  // Manual Entry Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    sport_type: 'funminton' as 'funminton' | 'padel',
    entry_date: new Date().toISOString().split('T')[0],
    category: 'outcome' as 'income' | 'outcome',
    description: '',
    amount: 0,
    notes: ''
  });

  const loadData = async () => {
    // Load entries
    let query = supabase.from('cashflow_entries').select('*').order('entry_date', { ascending: true });
    if (activeTab !== 'gabungan') {
      query = query.eq('sport_type', activeTab);
    }
    const { data: entriesData } = await query;
    
    // Load related sessions
    const { data: sessionsData } = await supabase.from('sessions').select('*');
    const sessionsMap: Record<string, Session> = {};
    sessionsData?.forEach(s => sessionsMap[s.id] = s);

    if (entriesData) setEntries(entriesData);
    setSessions(sessionsMap);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [activeTab]);

  const handleDeleteEntry = async (id: string, source: string) => {
    if (source === 'auto' && !window.confirm('Entry ini dibuat otomatis dari sesi. Tetap hapus?')) return;
    if (source === 'manual' && !window.confirm('Hapus transaksi ini?')) return;
    const { error } = await supabase.from('cashflow_entries').delete().eq('id', id);
    if (error) { alert('Gagal hapus: ' + error.message); return; }
    loadData();
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('cashflow_entries').insert({
      ...formData,
      source: 'manual'
    });
    
    if (!error) {
      setIsModalOpen(false);
      loadData();
      setFormData({
        sport_type: 'funminton',
        entry_date: new Date().toISOString().split('T')[0],
        category: 'outcome',
        description: '',
        amount: 0,
        notes: ''
      });
    }
  };

  if (loading && entries.length === 0) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div></div>;

  const availableYears = Array.from(new Set(entries.map(e => e.entry_date.split('-')[0]))).sort().reverse();

  let runningBalance = 0;
  const entriesWithBalance = entries.map(entry => {
    if (entry.category === 'income') runningBalance += entry.amount;
    else runningBalance -= entry.amount;
    return { ...entry, balance: runningBalance };
  });

  const filteredEntries = entriesWithBalance.filter(entry => {
    const [year, month] = entry.entry_date.split('-');
    const matchMonth = filterMonth === 'all' || month === filterMonth;
    const matchYear = filterYear === 'all' || year === filterYear;
    return matchMonth && matchYear;
  });

  const displayEntries = [...filteredEntries].reverse();

  const totalIncome = filteredEntries.filter(e => e.category === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalOutcome = filteredEntries.filter(e => e.category === 'outcome').reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalOutcome;
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-sm md:text-base text-gray-500 mt-2">Pantau arus kas, pemasukan, dan pengeluaran komunitas.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2 border rounded-xl bg-white text-sm outline-none">
            <option value="all">Semua Bulan</option>
            <option value="01">Januari</option>
            <option value="02">Februari</option>
            <option value="03">Maret</option>
            <option value="04">April</option>
            <option value="05">Mei</option>
            <option value="06">Juni</option>
            <option value="07">Juli</option>
            <option value="08">Agustus</option>
            <option value="09">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="px-3 py-2 border rounded-xl bg-white text-sm outline-none">
            <option value="all">Semua Tahun</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-primary-navy hover:bg-opacity-90 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Catat Transaksi</span>
            <span className="sm:hidden">Catat</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-green-600 mb-2">
            <TrendingUp size={20} />
            <h3 className="font-medium text-gray-500">Total Income (YTD)</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-red-500 mb-2">
            <TrendingDown size={20} />
            <h3 className="font-medium text-gray-500">Total Outcome (YTD)</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOutcome)}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-primary-purple mb-2">
            <Wallet size={20} />
            <h3 className="font-medium text-gray-500">Net Profit {filterMonth !== 'all' || filterYear !== 'all' ? '(Bulan ini)' : '(YTD)'}</h3>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-primary-amber mb-2">
            <Activity size={20} />
            <h3 className="font-medium text-gray-500">Margin Rata-rata</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{margin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap pb-2">
        {[
          { id: 'gabungan', label: 'Semua Transaksi' },
          { id: 'funminton', label: 'Funminton' },
          { id: 'padel', label: 'Padel' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-4 font-medium transition-all border-b-2 ${
              activeTab === tab.id ? 'border-primary-navy text-primary-navy' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-4 font-medium">Tanggal</th>
                <th className="p-4 font-medium">Sport</th>
                <th className="p-4 font-medium">Kategori / Deskripsi</th>
                <th className="p-4 font-medium">Sesi Terkait</th>
                <th className="p-4 font-medium text-right">Masuk</th>
                <th className="p-4 font-medium text-right">Keluar</th>
                <th className="p-4 font-medium text-right">Saldo</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayEntries.map(entry => {
                const relatedSession = entry.session_id ? sessions[entry.session_id] : null;

                return (
                  <tr key={entry.id} className="hover:bg-gray-50/50">
                    <td className="p-4">{formatDate(entry.entry_date)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                        entry.sport_type === 'funminton' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {entry.sport_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{entry.description}</p>
                      {entry.notes && <p className="text-xs text-gray-500">{entry.notes}</p>}
                    </td>
                    <td className="p-4 text-gray-500">
                      {relatedSession ? (
                        <div>
                          <p>{formatDate(relatedSession.session_date)}</p>
                          <p className="text-xs">{relatedSession.venue}</p>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-right text-green-600 font-medium">
                      {entry.category === 'income' ? formatCurrency(entry.amount) : '-'}
                    </td>
                    <td className="p-4 text-right text-red-500 font-medium">
                      {entry.category === 'outcome' ? formatCurrency(entry.amount) : '-'}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-900">
                      {formatCurrency(entry.balance)}
                    </td>
                    <td className="p-4">
                      <button onClick={() => handleDeleteEntry(entry.id, entry.source)} className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50" title="Hapus entry">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {displayEntries.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Belum ada transaksi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Catat Transaksi Manual</h2>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" required className="w-full px-3 py-2 border rounded-xl" 
                    value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select className="w-full px-3 py-2 border rounded-xl bg-white" 
                    value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                    <option value="income">Pemasukan</option>
                    <option value="outcome">Pengeluaran</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
                <select className="w-full px-3 py-2 border rounded-xl bg-white" 
                  value={formData.sport_type} onChange={e => setFormData({...formData, sport_type: e.target.value as any})}>
                  <option value="funminton">Funminton</option>
                  <option value="padel">Padel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Transaksi</label>
                <input type="text" required placeholder="Beli Kok / Bayar DP Lapangan" className="w-full px-3 py-2 border rounded-xl" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal</label>
                <CurrencyInput required value={formData.amount} onChange={val => setFormData({...formData, amount: val})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan</label>
                <input type="text" className="w-full px-3 py-2 border rounded-xl" 
                  value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => {
                  setIsModalOpen(false);
                  setFormData({
                    sport_type: 'funminton',
                    entry_date: new Date().toISOString().split('T')[0],
                    category: 'outcome',
                    description: '',
                    amount: 0,
                    notes: ''
                  });
                }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" className="px-6 py-2 bg-primary-navy text-white rounded-xl hover:bg-opacity-90">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
