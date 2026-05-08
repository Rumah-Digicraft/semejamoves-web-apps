import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Users, Copy, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Session } from '../types';
import { formatDate } from '../utils/format';
import CurrencyInput from '../components/CurrencyInput';

const defaultFormData = {
  session_date: '',
  venue: '',
  max_participants: 24,
  price_per_person: 15000,
  court_cost: 0,
  other_cost: 0,
  other_cost_description: '',
  notes: ''
};

export default function Funminton() {
  const [sessions, setSessions] = useState<(Session & { participants: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [formData, setFormData] = useState(defaultFormData);
  const [sessionSlots, setSessionSlots] = useState([{ time: '', courts: '' }]);

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, participants(id, payment_status)')
      .eq('sport_type', 'funminton')
      .order('session_date', { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const addSlot = () => setSessionSlots(prev => [...prev, { time: '', courts: '' }]);
  const removeSlot = (i: number) => setSessionSlots(prev => prev.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, field: 'time' | 'courts', value: string) => {
    setSessionSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleCreateSession = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const slots = sessionSlots.filter(s => s.time || s.courts);
    const { error } = await supabase.from('sessions').insert({
      sport_type: 'funminton',
      ...formData,
      session_slots: slots.length > 0 ? slots : null
    });

    if (!error) {
      setIsModalOpen(false);
      loadSessions();
      setFormData(defaultFormData);
      setSessionSlots([{ time: '', courts: '' }]);
    } else {
      alert('Gagal membuat sesi: ' + error.message);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/f/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Funminton Sessions</h1>
          <p className="text-sm md:text-base text-gray-500 mt-2">Kelola sesi, kehadiran, dan pembayaran Funminton.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto flex justify-center items-center gap-2 bg-primary-green hover:bg-opacity-90 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm"
        >
          <Plus size={20} />
          Buat Sesi Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map(session => {
          const totalParticipants = session.participants?.length || 0;
          const paidParticipants = session.participants?.filter(p => p.payment_status === 'approved').length || 0;

          return (
            <div key={session.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  session.status === 'open' ? 'bg-green-100 text-green-700' :
                  session.status === 'done' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                }`}>
                  {session.status.toUpperCase()}
                </span>

                <button
                  onClick={(e) => { e.preventDefault(); copyLink(session.token); }}
                  className="text-gray-400 hover:text-primary-purple transition-colors p-2 rounded-lg hover:bg-purple-50"
                  title="Copy Public Form Link"
                >
                  {copiedToken === session.token ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                </button>
              </div>

              <Link to={`/funminton/sessions/${session.id}`} className="block group">
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-purple transition-colors">
                  {formatDate(session.session_date)}
                </h3>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-gray-500 text-sm gap-2">
                    <MapPin size={16} />
                    <span>{session.venue}</span>
                  </div>
                  <div className="flex items-center text-gray-500 text-sm gap-2">
                    <Users size={16} />
                    <span>{totalParticipants} / {session.max_participants} Peserta</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Pembayaran</span>
                    <span className="font-medium text-gray-900">{paidParticipants} / {totalParticipants} Lunas</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                    <div
                      className="bg-primary-green h-2 rounded-full transition-all"
                      style={{ width: `${totalParticipants > 0 ? (paidParticipants / totalParticipants) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">
            Belum ada sesi Funminton.
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Buat Sesi Funminton</h2>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" required className="w-full px-3 py-2 border rounded-xl"
                    value={formData.session_date} onChange={e => setFormData({...formData, session_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input type="text" required placeholder="Nama GOR" className="w-full px-3 py-2 border rounded-xl"
                    value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Jadwal & Lapangan</label>
                  <button type="button" onClick={addSlot}
                    className="text-xs text-primary-green font-medium flex items-center gap-1 hover:opacity-80">
                    <Plus size={13} /> Tambah Slot
                  </button>
                </div>
                <div className="space-y-2">
                  {sessionSlots.map((slot, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" placeholder="19.00–21.00"
                        className="w-32 flex-shrink-0 px-3 py-2 border rounded-xl text-sm"
                        value={slot.time} onChange={e => updateSlot(i, 'time', e.target.value)} />
                      <input type="text" placeholder="Lapangan 1 & 5"
                        className="min-w-0 flex-1 px-3 py-2 border rounded-xl text-sm"
                        value={slot.courts} onChange={e => updateSlot(i, 'courts', e.target.value)} />
                      {sessionSlots.length > 1 && (
                        <button type="button" onClick={() => removeSlot(i)}
                          className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maks Peserta</label>
                  <input type="number" required className="w-full px-3 py-2 border rounded-xl"
                    value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga / Orang</label>
                  <CurrencyInput required value={formData.price_per_person} onChange={val => setFormData({...formData, price_per_person: val})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Biaya Sewa Lapangan (Total)</label>
                <CurrencyInput required value={formData.court_cost} onChange={val => setFormData({...formData, court_cost: val})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Biaya Lain-lain (Opsional)</label>
                  <CurrencyInput value={formData.other_cost} onChange={val => setFormData({...formData, other_cost: val})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ket. Biaya Lain</label>
                  <input type="text" placeholder="Kok, minum, dll" className="w-full px-3 py-2 border rounded-xl"
                    value={formData.other_cost_description} onChange={e => setFormData({...formData, other_cost_description: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <textarea className="w-full px-3 py-2 border rounded-xl" rows={3}
                  value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => {
                  setIsModalOpen(false);
                  setFormData(defaultFormData);
                  setSessionSlots([{ time: '', courts: '' }]);
                }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" className="px-6 py-2 bg-primary-green text-white rounded-xl hover:bg-opacity-90">Simpan Sesi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
