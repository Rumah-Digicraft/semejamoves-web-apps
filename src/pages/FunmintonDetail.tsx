import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Session, Participant, PollingConfig, AnnouncementConfig } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Check, X, Copy, Image as ImageIcon, Trash2, Plus, Settings } from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';

export default function FunmintonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'peserta' | 'pembayaran' | 'ringkasan'>('peserta');
  
  // Modals state
  const [newParticipant, setNewParticipant] = useState({ name: '', phone: '' });
  const [addMode, setAddMode] = useState<'manual' | 'wa'>('manual');
  const [waText, setWaText] = useState('');
  const [detectedNames, setDetectedNames] = useState<{ name: string; checked: boolean }[]>([]);
  const [isEditCostModalOpen, setIsEditCostModalOpen] = useState(false);
  const [costForm, setCostForm] = useState({ court_cost: 0, additional_court_cost: 0, other_costs: [] as {desc: string, amount: number}[] });
  const [isCopied, setIsCopied] = useState(false);
  const [isPollingModalOpen, setIsPollingModalOpen] = useState(false);
  const [pollingForm, setPollingForm] = useState<PollingConfig>({ enabled: false, question: 'Minggu depan mau main kapan?', options: ['Jumat Malam', 'Sabtu Pagi'] });
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementConfig>({ enabled: false, type: 'next_session', title: 'Funminton Malam Minggu 🏸✨', date: '', caption: 'no cap minggu depan kita minton lagi bestie, jangan ghosting ya fr fr 🔥' });

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
    navigator.clipboard.writeText(`${window.location.origin}/f/${session.token}`);
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
      if (sessionData.polling_config) {
        setPollingForm(sessionData.polling_config);
      }
      if (sessionData.announcement_config) {
        setAnnouncementForm(sessionData.announcement_config);
      }
    }
    if (participantsData) setParticipants(participantsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const names = newParticipant.name.split('\n').filter(n => n.trim());

    const inserts = names.map(n => ({
      session_id: id,
      name: n.trim(),
      phone: newParticipant.phone || null
    }));

    await supabase.from('participants').insert(inserts);
    setNewParticipant({ name: '', phone: '' });
    loadData();
  };

  const handleDetectNames = () => {
    const matches = [...waText.matchAll(/^\d+\.\s+(.+)/gm)];
    const names = matches.map(m => m[1].trim()).filter(Boolean);
    setDetectedNames(names.map(name => ({ name, checked: true })));
  };

  const toggleDetected = (i: number) => {
    setDetectedNames(prev => prev.map((item, idx) => idx === i ? { ...item, checked: !item.checked } : item));
  };

  const handleAddFromWA = async () => {
    if (!id) return;
    const inserts = detectedNames.filter(d => d.checked).map(d => ({ session_id: id, name: d.name, phone: null }));
    if (inserts.length === 0) return;
    await supabase.from('participants').insert(inserts);
    setWaText('');
    setDetectedNames([]);
    setAddMode('manual');
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

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await supabase.from('sessions').update({ announcement_config: announcementForm }).eq('id', id);
    setIsAnnouncementModalOpen(false);
    loadData();
  };

  const handleSavePolling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await supabase.from('sessions').update({ polling_config: pollingForm }).eq('id', id);
    setIsPollingModalOpen(false);
    loadData();
  };

  const toggleAttendance = async (participantId: string, current: boolean) => {
    await supabase.from('participants').update({ attended: !current }).eq('id', participantId);
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

    navigate('/funminton');
  };

  if (loading || !session) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div></div>;

  const totalIncome = participants.filter(p => p.payment_status === 'approved').length * session.price_per_person;
  const totalOutcome = session.court_cost + session.other_cost;
  const profit = totalIncome - totalOutcome;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{formatDate(session.session_date)}</h1>
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

      <div className="flex gap-4 border-b border-gray-200 mb-6 overflow-x-auto pb-2">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="p-4 font-medium w-8">#</th>
                    <th className="p-4 font-medium">Nama</th>
                    <th className="p-4 font-medium text-center">Bayar</th>
                    <th className="p-4 font-medium text-center">Hadir</th>
                    <th className="p-4 font-medium text-center">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {participants.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="p-4">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.phone && <span className="block text-xs text-gray-400">{p.phone}</span>}
                      </td>
                      <td className="p-4 text-center">
                        {p.payment_status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            <Check size={11} /> Lunas
                          </span>
                        ) : p.payment_status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-600">
                            <X size={11} /> Ditolak
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-600">Belum</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleAttendance(p.id, p.attended)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${p.attended ? 'bg-primary-green text-white shadow-sm' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                          title="Tandai Hadir/Absen"
                        >
                          <Check size={15} />
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => deleteParticipant(p.id)} className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 mx-auto flex">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {participants.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada peserta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Tambah Peserta</h3>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  <button type="button" onClick={() => setAddMode('manual')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${addMode === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Manual</button>
                  <button type="button" onClick={() => setAddMode('wa')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${addMode === 'wa' ? 'bg-white shadow text-primary-purple' : 'text-gray-500'}`}>Import WA</button>
                </div>
              </div>

              {addMode === 'manual' ? (
                <form onSubmit={handleAddParticipant} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nama (Bisa multiple baris)</label>
                    <textarea required rows={3} className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Andi&#10;Budi&#10;Citra"
                      value={newParticipant.name} onChange={e => setNewParticipant({...newParticipant, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">No. HP (Opsional)</label>
                    <input type="text" className="w-full px-3 py-2 border rounded-xl text-sm"
                      value={newParticipant.phone} onChange={e => setNewParticipant({...newParticipant, phone: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-primary-purple text-white py-2 rounded-xl text-sm font-medium hover:bg-opacity-90">Tambah</button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Paste teks dari WA</label>
                    <textarea rows={5} className="w-full px-3 py-2 border rounded-xl text-sm font-mono" placeholder="1. Gafar&#10;2. Afif&#10;3. Ilham&#10;..."
                      value={waText} onChange={e => { setWaText(e.target.value); setDetectedNames([]); }} />
                  </div>
                  <button type="button" onClick={handleDetectNames} disabled={!waText.trim()}
                    className="w-full bg-gray-800 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40">
                    Deteksi Nama
                  </button>
                  {detectedNames.length > 0 && (
                    <>
                      <div className="text-xs text-gray-500 font-medium">{detectedNames.filter(d => d.checked).length} dari {detectedNames.length} nama dipilih</div>
                      <div className="max-h-48 overflow-y-auto border rounded-xl divide-y">
                        {detectedNames.map((item, i) => (
                          <label key={i} className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${item.checked ? 'bg-purple-50' : 'bg-white'}`}>
                            <input type="checkbox" checked={item.checked} onChange={() => toggleDetected(i)} className="w-4 h-4 text-primary-purple rounded" />
                            <span className="text-sm text-gray-800">{item.name}</span>
                          </label>
                        ))}
                      </div>
                      <button type="button" onClick={handleAddFromWA} disabled={detectedNames.filter(d => d.checked).length === 0}
                        className="w-full bg-primary-purple text-white py-2 rounded-xl text-sm font-medium hover:bg-opacity-90 disabled:opacity-40">
                        Tambah {detectedNames.filter(d => d.checked).length} Peserta
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm bg-gradient-to-br from-purple-50 to-white">
              <h3 className="font-bold text-primary-navy mb-2">Public Link Form</h3>
              <p className="text-xs text-gray-500 mb-4">Bagikan link ini ke grup WA agar peserta bisa bayar & upload bukti sendiri.</p>
              <div className="flex items-center gap-2">
                <input readOnly value={`${window.location.origin}/f/${session.token}`} className="w-full bg-white px-3 py-2 border rounded-lg text-xs text-gray-500" />
                <button onClick={handleCopyLink} className={`p-2 rounded-lg transition-colors text-white ${isCopied ? 'bg-green-500' : 'bg-primary-purple hover:bg-opacity-90'}`}>
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Settings size={16} /> Pengumuman</h3>
                <button onClick={() => setIsAnnouncementModalOpen(true)} className="text-xs text-primary-purple font-medium hover:underline">Edit</button>
              </div>
              {session.announcement_config?.enabled ? (
                <>
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full mb-2 ${session.announcement_config.type === 'libur' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {session.announcement_config.type === 'next_session' ? 'Next Session' : session.announcement_config.type === 'libur' ? 'Libur' : 'Custom'}
                  </span>
                  <p className="text-sm font-semibold text-gray-800">{session.announcement_config.title}</p>
                  {session.announcement_config.date && <p className="text-xs text-gray-500 mt-0.5">{session.announcement_config.date}</p>}
                  {session.announcement_config.caption && <p className="text-xs text-gray-500 mt-1 italic">"{session.announcement_config.caption}"</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Pengumuman belum diaktifkan.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Settings size={16} /> Polling Minggu Depan</h3>
                <button onClick={() => setIsPollingModalOpen(true)} className="text-xs text-primary-purple font-medium hover:underline">Edit</button>
              </div>
              {session.polling_config?.enabled ? (
                <>
                  <p className="text-xs font-medium text-green-600 mb-1">Aktif di form peserta</p>
                  <p className="text-sm text-gray-700 font-medium">{session.polling_config.question}</p>
                  <ul className="mt-2 space-y-1">
                    {session.polling_config.options.map((opt, i) => (
                      <li key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />{opt}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Polling belum diaktifkan. Klik Edit untuk mengatur.</p>
              )}
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

      {activeTab === 'ringkasan' && (() => {
        const pollingOptions = session.polling_config?.options ?? ['Jumat Malam', 'Sabtu Pagi'];
        const pollCounts = pollingOptions.map(opt => ({
          label: opt,
          count: participants.filter(p => p.polling_hari === opt).length
        }));
        const totalVotes = pollCounts.reduce((s, o) => s + o.count, 0);
        const saranList = participants.filter(p => p.kritik_saran);

        return (
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

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-1">{session.polling_config?.question ?? 'Polling — Minggu Depan Kapan?'}</h3>
              {!session.polling_config?.enabled && <p className="text-xs text-amber-500 mb-3">Polling belum diaktifkan di form peserta</p>}
              {totalVotes === 0 ? (
                <p className="text-sm text-gray-400 italic mt-3">Belum ada yang vote.</p>
              ) : (
                <div className="space-y-3 mt-3">
                  {pollCounts.map(({ label, count }) => {
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{label}</span>
                          <span className="text-gray-500">{count} vote ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div className="bg-primary-green h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 pt-1">{totalVotes} dari {participants.length} peserta sudah vote</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Kritik & Saran</h3>
              {saranList.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Belum ada saran masuk.</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {saranList.map(p => (
                    <div key={p.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{p.name}</p>
                      <p className="text-sm text-gray-800">{p.kritik_saran}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}


      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-5">Pengaturan Pengumuman</h2>
            <form onSubmit={handleSaveAnnouncement} className="space-y-4">

              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Tampilkan pengumuman di form peserta</span>
                <div
                  onClick={() => setAnnouncementForm(f => ({ ...f, enabled: !f.enabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${announcementForm.enabled ? 'bg-primary-green' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${announcementForm.enabled ? 'translate-x-5' : ''}`} />
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Pengumuman</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'next_session', label: '📅 Next Session' },
                    { value: 'libur', label: '🚫 Libur' },
                    { value: 'custom', label: '✏️ Custom' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const defaults = opt.value === 'libur'
                          ? { title: 'Libur Minggu Depan 😴', caption: 'minggu depan moves fun badminton libur dulu ya bestie, see you next time! 🙏' }
                          : opt.value === 'next_session'
                          ? { title: 'Funminton Malam Minggu 🏸✨', caption: 'no cap minggu depan kita minton lagi bestie, jangan ghosting ya fr fr 🔥' }
                          : { title: '', caption: '' };
                        setAnnouncementForm(f => ({ ...f, type: opt.value, ...defaults }));
                      }}
                      className={`py-2 px-3 text-xs font-medium rounded-xl border transition-colors ${announcementForm.type === opt.value ? 'bg-primary-navy text-white border-primary-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {announcementForm.type === 'libur' ? 'Judul' : 'Judul Sesi'}
                </label>
                <input type="text" required className="w-full px-3 py-2 border rounded-xl text-sm"
                  value={announcementForm.title}
                  onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {announcementForm.type !== 'libur' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal / Info Tambahan</label>
                  <input type="text" placeholder="Sabtu, 23 Mei 2026" className="w-full px-3 py-2 border rounded-xl text-sm"
                    value={announcementForm.date}
                    onChange={e => setAnnouncementForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
                <textarea rows={3} className="w-full px-3 py-2 border rounded-xl text-sm resize-none"
                  value={announcementForm.caption}
                  onChange={e => setAnnouncementForm(f => ({ ...f, caption: e.target.value }))} />
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Preview</p>
                {announcementForm.type === 'libur' ? (
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">🚫 Pengumuman</p>
                    <p className="text-sm font-bold text-gray-900">{announcementForm.title || '—'}</p>
                    {announcementForm.caption && <p className="text-xs text-red-700 mt-1 font-medium">{announcementForm.caption}</p>}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">📢 Next Session</p>
                    <p className="text-sm font-bold text-gray-900">{announcementForm.title || '—'}</p>
                    {announcementForm.date && <p className="text-xs text-gray-600 mt-0.5">{announcementForm.date}</p>}
                    {announcementForm.caption && <p className="text-xs text-green-700 mt-1 font-medium">{announcementForm.caption}</p>}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm">Batal</button>
                <button type="submit" className="px-6 py-2 bg-primary-navy text-white rounded-xl text-sm font-medium hover:bg-opacity-90">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPollingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-5">Pengaturan Polling</h2>
            <form onSubmit={handleSavePolling} className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Tampilkan polling di form peserta</span>
                <div
                  onClick={() => setPollingForm(f => ({ ...f, enabled: !f.enabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${pollingForm.enabled ? 'bg-primary-green' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pollingForm.enabled ? 'translate-x-5' : ''}`} />
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
                <input type="text" required className="w-full px-3 py-2 border rounded-xl text-sm"
                  value={pollingForm.question} onChange={e => setPollingForm(f => ({ ...f, question: e.target.value }))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Pilihan Jawaban</label>
                  <button type="button" onClick={() => setPollingForm(f => ({ ...f, options: [...f.options, ''] }))}
                    className="text-xs text-primary-purple flex items-center gap-1 hover:underline">
                    <Plus size={13} /> Tambah
                  </button>
                </div>
                <div className="space-y-2">
                  {pollingForm.options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" required placeholder={`Pilihan ${i + 1}`} className="flex-1 px-3 py-2 border rounded-xl text-sm"
                        value={opt} onChange={e => setPollingForm(f => ({ ...f, options: f.options.map((o, idx) => idx === i ? e.target.value : o) }))} />
                      {pollingForm.options.length > 2 && (
                        <button type="button" onClick={() => setPollingForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsPollingModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm">Batal</button>
                <button type="submit" className="px-6 py-2 bg-primary-purple text-white rounded-xl text-sm font-medium hover:bg-opacity-90">Simpan</button>
              </div>
            </form>
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
