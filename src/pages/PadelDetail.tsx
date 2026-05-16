import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Session, Participant } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Check, X, Copy, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';

export default function PadelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'peserta' | 'pembayaran' | 'ringkasan'>('peserta');

  const [isEditCostModalOpen, setIsEditCostModalOpen] = useState(false);
  const [costForm, setCostForm] = useState({ court_cost: 0, additional_court_cost: 0, other_costs: [] as {desc: string, amount: number}[] });
  const [isCopied, setIsCopied] = useState(false);

  const getParsedOtherCosts = (sessionData: Session | null) => {
    if (!sessionData) return [];
    try {
      if (sessionData.other_cost_description?.startsWith('[')) {
        return JSON.parse(sessionData.other_cost_description);
      }
    } catch(e) {}
    if (sessionData.other_cost > 0 || sessionData.other_cost_description) {
      return [{ desc: sessionData.other_cost_description || 'Biaya Lain', amount: sessionData.other_cost }];
    }
    return [];
  };

  const handleCopyLink = () => {
    if (!session) return;
    navigator.clipboard.writeText(`${window.location.origin}/p/${session.token}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const loadData = async () => {
    if (!id) return;
    const { data: sessionData } = await supabase.from('sessions').select('*').eq('id', id).single();
    const { data: participantsData } = await supabase.from('participants').select('*').eq('session_id', id).order('created_at', { ascending: true });
    
    if (sessionData) {
      setSession(sessionData);
      setCostForm({
        court_cost: sessionData.court_cost,
        additional_court_cost: 0,
        other_costs: getParsedOtherCosts(sessionData)
      });
    }
    if (participantsData) setParticipants(participantsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const toggleAttendance = async (participantId: string, current: boolean) => {
    await supabase.from('participants').update({ attended: !current }).eq('id', participantId);
    loadData();
  };

  const handleUpdateCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !session) return;
    
    const totalOtherCost = costForm.other_costs.reduce((sum, cost) => sum + cost.amount, 0);
    const otherCostDesc = JSON.stringify(costForm.other_costs);

    await supabase.from('sessions').update({
      court_cost: costForm.court_cost + costForm.additional_court_cost,
      other_cost: totalOtherCost,
      other_cost_description: otherCostDesc
    }).eq('id', id);
    setIsEditCostModalOpen(false);
    loadData();
  };

  const updatePaymentStatus = async (participantId: string, status: 'approved' | 'rejected') => {
    await supabase.from('participants').update({ payment_status: status }).eq('id', participantId);
    loadData();
  };

  const deleteParticipant = async (participantId: string) => {
    if (!window.confirm('Hapus peserta ini?')) return;
    const { error } = await supabase.from('participants').delete().eq('id', participantId);
    if (error) { alert('Gagal hapus peserta: ' + error.message); return; }
    loadData();
  };

  const markAsDone = async () => {
    if (!session || !id) return;
    if (!window.confirm('Tutup sesi dan masukkan ke cashflow?')) return;

    const totalIncome = participants.filter(p => p.payment_status === 'approved').length * session.price_per_person;

    const entries = [];
    if (session.court_cost > 0) {
      entries.push({ session_id: id, sport_type: session.sport_type, entry_date: new Date().toISOString().split('T')[0], category: 'outcome', description: 'Sewa Lapangan', amount: session.court_cost, source: 'auto' });
    }
    const parsedOtherCosts = getParsedOtherCosts(session);
    parsedOtherCosts.forEach((cost: any) => {
      if (cost.amount > 0) {
        entries.push({ session_id: id, sport_type: session.sport_type, entry_date: new Date().toISOString().split('T')[0], category: 'outcome', description: cost.desc || 'Biaya Lain', amount: cost.amount, source: 'auto' });
      }
    });
    if (totalIncome > 0) {
      entries.push({ session_id: id, sport_type: session.sport_type, entry_date: new Date().toISOString().split('T')[0], category: 'income', description: 'Iuran Peserta', amount: totalIncome, source: 'auto' });
    }

    if (entries.length > 0) {
      await supabase.from('cashflow_entries').insert(entries);
    }
    await supabase.from('sessions').update({ status: 'done' }).eq('id', id);
    loadData();
  };

  const deleteSession = async () => {
    if (!id) return;
    if (!window.confirm('Yakin ingin menghapus sesi ini beserta seluruh pesertanya? Tindakan ini tidak dapat dibatalkan.')) return;

    const { error: e1 } = await supabase.from('cashflow_entries').delete().eq('session_id', id);
    if (e1) { alert('Gagal hapus cashflow: ' + e1.message); return; }

    const { error: e2 } = await supabase.from('participants').delete().eq('session_id', id);
    if (e2) { alert('Gagal hapus peserta: ' + e2.message); return; }

    const { error: e3 } = await supabase.from('sessions').delete().eq('id', id);
    if (e3) { alert('Gagal hapus sesi: ' + e3.message); return; }

    navigate('/padel');
  };

  if (loading || !session) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div></div>;

  const totalIncome = participants.filter(p => p.payment_status === 'approved').length * session.price_per_person;
  const totalOutcome = session.court_cost + session.other_cost;
  const profit = totalIncome - totalOutcome;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{formatDate(session.session_date)}</h1>
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
              session.status === 'open' ? 'bg-green-100 text-green-700' :
              session.status === 'done' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
            }`}>
              {session.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm md:text-base text-gray-500 mt-1">{session.venue} • {session.max_participants} Maks Peserta • {formatCurrency(session.price_per_person)}/orang</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={deleteSession} className="flex-1 md:flex-none bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-2">
            <Trash2 size={16} /> Hapus Sesi
          </button>
          {session.status === 'open' && (
            <button onClick={markAsDone} className="flex-1 md:flex-none bg-primary-navy text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-opacity-90">
              Selesaikan Sesi
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6">
        {['peserta', 'pembayaran', 'ringkasan'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-3 px-2 font-medium capitalize transition-all border-b-2 ${
              activeTab === tab ? 'border-primary-purple text-primary-purple' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'peserta' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4 font-medium">Nama</th>
                  <th className="p-4 font-medium">No. HP</th>
                  <th className="p-4 font-medium">Hadir</th>
                  <th className="p-4 font-medium">Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {participants.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-medium text-gray-900">{p.name}</td>
                    <td className="p-4 text-gray-500">{p.phone || '-'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleAttendance(p.id, p.attended)} className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${p.attended ? 'bg-primary-purple text-white' : 'bg-gray-200 text-transparent'}`} title="Tandai Hadir/Absen">
                          <Check size={16} />
                        </button>
                        <button onClick={() => deleteParticipant(p.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1 rounded-md" title="Hapus Peserta">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        p.payment_status === 'approved' ? 'bg-green-100 text-green-700' :
                        p.payment_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
                {participants.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada peserta yang mendaftar.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm bg-gradient-to-br from-purple-50 to-white">
              <h3 className="font-bold text-primary-navy mb-2">Public Registration Link</h3>
              <p className="text-xs text-gray-500 mb-4">Bagikan link ini agar peserta bisa mendaftar & bayar mandiri.</p>
              <div className="flex items-center gap-2">
                <input readOnly value={`${window.location.origin}/p/${session.token}`} className="w-full bg-white px-3 py-2 border rounded-lg text-xs text-gray-500" />
                <button onClick={handleCopyLink} className={`p-2 rounded-lg transition-colors text-white ${isCopied ? 'bg-green-500' : 'bg-primary-purple hover:bg-opacity-90'}`}>
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pembayaran' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4 font-medium">Nama</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Bukti Foto</th>
                  <th className="p-4 font-medium">OCR Data</th>
                  <th className="p-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {participants.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        p.payment_status === 'approved' ? 'bg-green-100 text-green-700' :
                        p.payment_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {p.payment_status}
                      </span>
                      {p.ocr_match === false && <span className="ml-2 text-xs text-red-500 font-medium block mt-1">Flagged OCR</span>}
                    </td>
                    <td className="p-4">
                      {p.payment_proof_url ? (
                        <a href={p.payment_proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-purple hover:underline">
                          <ImageIcon size={16} /> Lihat
                        </a>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-xs text-gray-500 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={JSON.stringify(p.ocr_raw)}>
                      {p.ocr_raw ? JSON.stringify(p.ocr_raw) : 'Belum submit'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button onClick={() => updatePaymentStatus(p.id, 'approved')} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Approve"><Check size={16} /></button>
                        <button onClick={() => updatePaymentStatus(p.id, 'rejected')} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Reject"><X size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ringkasan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Statistik Kehadiran</h3>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">Total Terdaftar</span>
              <span className="font-medium text-gray-900">{participants.length} orang</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm">
              <span className="text-gray-500">Total Hadir</span>
              <span className="font-medium text-gray-900">{participants.filter(p => p.attended).length} orang</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Ringkasan Keuangan</h3>
              <button onClick={() => setIsEditCostModalOpen(true)} className="text-xs text-primary-purple hover:underline font-medium">Edit Biaya / Nambah Jam</button>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">Total Pemasukan (Approved)</span>
              <span className="font-medium text-green-600">{formatCurrency(totalIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">Sewa Lapangan</span>
              <span className="font-medium text-red-600">-{formatCurrency(session.court_cost)}</span>
            </div>
            {getParsedOtherCosts(session).map((cost: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-500">Biaya Lain: {cost.desc || '-'}</span>
                <span className="font-medium text-red-600">-{formatCurrency(cost.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-4 mt-2 border-t border-gray-200 text-base font-bold">
              <span className="text-gray-900">Profit / Rugi</span>
              <span className={profit >= 0 ? 'text-primary-green' : 'text-red-600'}>{formatCurrency(profit)}</span>
            </div>
          </div>
        </div>
      )}

      {isEditCostModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Update Biaya Operasional</h2>
            <form onSubmit={handleUpdateCosts} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sewa Lapangan (Awal)</label>
                  <CurrencyInput required value={costForm.court_cost} onChange={val => setCostForm({...costForm, court_cost: val})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tambah Jam (Opsional)</label>
                  <CurrencyInput value={costForm.additional_court_cost} onChange={val => setCostForm({...costForm, additional_court_cost: val})} />
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center text-sm">
                <span className="text-blue-800">Total Sewa Lapangan:</span>
                <span className="font-bold text-blue-900">{formatCurrency(costForm.court_cost + costForm.additional_court_cost)}</span>
              </div>
              
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">Biaya Lain-lain</label>
                  <button type="button" onClick={() => setCostForm({...costForm, other_costs: [...costForm.other_costs, {desc: '', amount: 0}]})} className="text-xs text-primary-purple flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Tambah
                  </button>
                </div>
                {costForm.other_costs.map((cost, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex-1 space-y-2">
                      <input type="text" placeholder="Keterangan (mis: Kok, Air)" className="w-full px-3 py-2 border rounded-xl text-sm"
                        value={cost.desc} onChange={e => {
                          const newCosts = [...costForm.other_costs];
                          newCosts[idx].desc = e.target.value;
                          setCostForm({...costForm, other_costs: newCosts});
                        }} />
                      <CurrencyInput value={cost.amount} onChange={val => {
                          const newCosts = [...costForm.other_costs];
                          newCosts[idx].amount = val;
                          setCostForm({...costForm, other_costs: newCosts});
                      }} />
                    </div>
                    <button type="button" onClick={() => {
                       const newCosts = costForm.other_costs.filter((_, i) => i !== idx);
                       setCostForm({...costForm, other_costs: newCosts});
                    }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-1"><Trash2 size={16} /></button>
                  </div>
                ))}
                {costForm.other_costs.length === 0 && <p className="text-xs text-gray-500 italic">Tidak ada biaya lain.</p>}
              </div>

              <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-gray-100">
                <button type="button" onClick={() => {
                  setIsEditCostModalOpen(false);
                  if (session) setCostForm({ court_cost: session.court_cost, additional_court_cost: 0, other_costs: getParsedOtherCosts(session) });
                }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
                <button type="submit" className="px-6 py-2 bg-primary-navy text-white rounded-xl hover:bg-opacity-90">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
