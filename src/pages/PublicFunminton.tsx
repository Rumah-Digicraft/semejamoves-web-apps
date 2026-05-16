import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { analyzePaymentProof } from '../lib/gemini';
import type { Session, Participant } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Activity, Upload, Download, X } from 'lucide-react';
import qrisImage from '../assets/qris.jpeg';

export default function PublicFunminton() {
  const { token } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<'approved' | 'pending' | false>(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [kritikSaran, setKritikSaran] = useState('');
  const [pollingAnswer, setPollingAnswer] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .eq('sport_type', 'funminton')
        .single();
        
      if (sessionError || !sessionData) {
        setLoading(false);
        return;
      }
      
      setSession(sessionData);

      const { data: pData } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionData.id)
        .neq('payment_status', 'approved');
        
      if (pData) setParticipants(pData);
      setLoading(false);
    }
    loadData();
  }, [token]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const compressImage = (f: File, maxPx = 1024, quality = 0.82): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !file || !session) {
      setErrorMsg('Pilih nama dan upload bukti pembayaran.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Compress then run OCR with Gemini
      const { base64: base64Content, mimeType } = await compressImage(file);
      const ocrResult = await analyzePaymentProof(base64Content, mimeType);
      
      // 2. Logic Auto-Approve Match
      const expectedTotal = selectedIds.length * session.price_per_person;
      let isMatch = false;
      
      if (ocrResult && typeof ocrResult.nominal === 'number') {
        if (ocrResult.nominal === expectedTotal) {
          isMatch = true;
        }
      }

      // 3. Upload file regardless of OCR result
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw new Error('Gagal upload gambar.');

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      // 4. Update participants — approved if match, pending (flagged) if not
      const updates = selectedIds.map(id => ({
        id,
        session_id: session.id,
        payment_status: isMatch ? 'approved' : 'pending',
        attended: isMatch ? true : undefined,
        payment_amount: ocrResult?.nominal || null,
        payment_date: ocrResult?.tanggal || new Date().toISOString().split('T')[0],
        payment_proof_url: publicUrl,
        ocr_raw: ocrResult,
        ocr_match: isMatch,
        submitted_at: new Date().toISOString(),
        kritik_saran: kritikSaran || null,
        polling_hari: pollingAnswer
      }));

      for (const update of updates) {
        await supabase.from('participants').update(update).eq('id', update.id);
      }

      setSuccess(isMatch ? 'approved' : 'pending');
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div></div>;

  if (!session) return <div className="min-h-screen bg-gray-50 p-8 text-center"><p className="text-xl text-gray-500">Sesi tidak ditemukan atau link tidak valid.</p></div>;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          {success === 'approved' ? (
            <>
              <div className="text-5xl mb-4">🏸✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Slay! Bayarnya valid bestie!</h2>
              <p className="text-gray-500 text-sm">Transfernya udah ke-detect, status udah auto approved. See you di lapangan minggu depan 🔥</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">📨</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Bukti sudah masuk!</h2>
              <p className="text-gray-500 text-sm">Bukti TF-mu udah ke-upload ya, tapi perlu konfirmasi manual sama admin dulu. Hubungi Afif, Ghafar, atau Ilham buat konfirmasi pembayarannya 🙏</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const expectedTotal = selectedIds.length * session.price_per_person;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-green text-white flex items-center justify-center rounded-xl shadow-lg mx-auto mb-4">
            <Activity size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pembayaran Funminton</h1>
          <p className="text-gray-500 mt-2">{formatDate(session.session_date)} • {session.venue}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
          {submitting && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-green mb-6"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Sabar bestie... 🤙</h3>
                <p className="text-gray-500 text-sm">AI lagi ngecek bukti tf mu, bentar lagi kok. jangan kemana-mana dulu ya teman semeja ✨</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                <div className="text-5xl mb-4">😭💀</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Aduh, AI-nya ga percaya nih... Coba lagi yuk</h3>
                <p className="text-gray-600 text-sm mb-6">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => setErrorMsg('')}
                  className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors"
                >
                  Coba lagi deh 🔄
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Nama Anda (Bisa &gt;1)</label>
            <div className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-1">
              {participants.length === 0 ? (
                <p className="text-sm text-gray-500 p-2 text-center">Semua peserta sudah membayar.</p>
              ) : (
                participants.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedIds.includes(p.id) ? 'bg-green-50 border-green-200 border' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 text-primary-green rounded focus:ring-primary-green" />
                    <span className="font-medium text-gray-900">{p.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Total Tagihan</span>
            <span className="text-xl font-bold text-primary-green">{formatCurrency(expectedTotal)}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 text-center">
            <p className="text-sm font-medium text-gray-700 mb-3">Scan QRIS di bawah ini untuk membayar:</p>
            <img src={qrisImage} alt="QRIS Semeja Kerja" className="w-full max-w-[240px] mx-auto rounded-xl shadow-sm border border-gray-200 mb-4" />
            <a href={qrisImage} download="QRIS_SemejaMoves.jpeg" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} /> Download QRIS
            </a>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Bukti Transfer (QRIS/Bank)</label>
            {file ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-700 truncate">{file.name}</p>
                  <p className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB — siap diupload</p>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-green-500 hover:text-red-500 p-1 flex-shrink-0 transition-colors">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-primary-green transition-colors bg-gray-50 cursor-pointer relative">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <span className="relative rounded-md font-medium text-primary-green">
                      <span>Upload foto</span>
                      <input type="file" className="sr-only" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                </div>
                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            )}
          </div>

          {session.announcement_config?.enabled && (
            session.announcement_config.type === 'libur' ? (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">🔊 Pengumuman</p>
                <p className="text-base font-bold text-gray-900">{session.announcement_config.title}</p>
                {session.announcement_config.caption && <p className="text-xs text-red-700 mt-2 font-medium">{session.announcement_config.caption}</p>}
              </div>
            ) : (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">📢 Next Session</p>
                <p className="text-base font-bold text-gray-900">{session.announcement_config.title}</p>
                {session.announcement_config.date && <p className="text-sm text-gray-600 mt-0.5">{session.announcement_config.date}</p>}
                {session.announcement_config.caption && <p className="text-xs text-green-700 mt-2 font-medium">{session.announcement_config.caption}</p>}
              </div>
            )
          )}

          {session.polling_config?.enabled && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">{session.polling_config.question}</p>
              <div className="space-y-2">
                {session.polling_config.options.map(opt => (
                  <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${pollingAnswer === opt ? 'bg-white border-primary-green shadow-sm' : 'bg-white/60 border-transparent hover:bg-white'}`}>
                    <input
                      type="radio"
                      name="polling"
                      value={opt}
                      checked={pollingAnswer === opt}
                      onChange={() => setPollingAnswer(opt)}
                      className="w-4 h-4 text-primary-green"
                    />
                    <span className="text-sm text-gray-800 font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kritik dan Saran <span className="text-gray-400 font-normal">(opsional)</span></label>
            <textarea
              placeholder="Kasih saran biar next minton tambah fun"
              className="w-full px-3 py-2 border rounded-xl text-sm resize-none"
              rows={3}
              value={kritikSaran}
              onChange={e => setKritikSaran(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || selectedIds.length === 0 || !file}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-green hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-green disabled:opacity-50 transition-all"
          >
            {submitting ? 'Memproses...' : 'Kirim Pembayaran'}
          </button>
        </form>
      </div>
    </div>
  );
}
