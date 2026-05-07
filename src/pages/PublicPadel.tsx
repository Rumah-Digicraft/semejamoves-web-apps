import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { analyzePaymentProof } from '../lib/gemini';
import type { Session } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { Trophy, Upload, CheckCircle2, X, Download } from 'lucide-react';
import qrisImage from '../assets/qris.jpeg';

export default function PublicPadel() {
  const { token } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .eq('sport_type', 'padel')
        .single();
        
      if (sessionError || !sessionData) {
        setLoading(false);
        return;
      }
      
      setSession(sessionData);
      setLoading(false);
    }
    loadData();
  }, [token]);

  const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !file || !session) {
      setErrorMsg('Isi nama dan upload bukti pembayaran.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Convert to Base64 and run OCR with Gemini
      const base64DataUrl = await toBase64(file);
      const base64Content = base64DataUrl.split(',')[1];
      const mimeType = file.type;
      
      const ocrResult = await analyzePaymentProof(base64Content, mimeType);
      
      // 2. Logic Auto-Approve Match
      const expectedTotal = session.price_per_person;
      let isMatch = false;
      
      if (ocrResult && typeof ocrResult.nominal === 'number') {
        const sessionDate = new Date(session.session_date);
        const ocrDate = ocrResult.tanggal ? new Date(ocrResult.tanggal) : null;
        
        let dateValid = false;
        if (ocrDate) {
          const diffTime = Math.abs(ocrDate.getTime() - sessionDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          dateValid = diffDays <= 1; // within 1 day
        }

        if (ocrResult.nominal === expectedTotal && dateValid) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        throw new Error('Bukti pembayaran tidak sesuai (Nominal/Tanggal). Silakan hubungi Pengurus (Afif, Ghafar, atau Ilham) untuk konfirmasi manual.');
      }

      // 3. Upload file to Supabase Storage ONLY IF MATCH
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw new Error('Gagal upload gambar.');

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      // 4. Insert participant (always approved since isMatch is true)
      const { error: insertError } = await supabase.from('participants').insert({
        session_id: session.id,
        name: formData.name,
        phone: formData.phone || null,
        payment_status: 'approved',
        attended: true,
        payment_amount: ocrResult?.nominal || expectedTotal,
        payment_date: ocrResult?.tanggal || new Date().toISOString().split('T')[0],
        payment_proof_url: publicUrl,
        ocr_raw: ocrResult,
        ocr_match: true,
        submitted_at: new Date().toISOString()
      });

      if (insertError) throw new Error('Gagal menyimpan data pendaftaran.');

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div></div>;

  if (!session) return <div className="min-h-screen bg-gray-50 p-8 text-center"><p className="text-xl text-gray-500">Sesi tidak ditemukan atau link tidak valid.</p></div>;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-16 h-16 bg-purple-100 text-primary-purple rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Terima Kasih!</h2>
          <p className="text-gray-500">Pendaftaran & bukti pembayaran berhasil dikirim. Anda bisa menutup halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-purple text-white flex items-center justify-center rounded-xl shadow-lg mx-auto mb-4">
            <Trophy size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registrasi Padel</h1>
          <p className="text-gray-500 mt-2">{formatDate(session.session_date)} • {session.venue}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
          {submitting && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-green mb-6"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Memproses Pembayaran</h3>
                <p className="text-gray-500 text-sm">Sedang memverifikasi bukti transfer Anda menggunakan AI. Mohon tunggu sebentar...</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Gagal Verifikasi</h3>
                <p className="text-gray-600 text-sm mb-6">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => setErrorMsg('')}
                  className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors"
                >
                  Tutup & Coba Lagi
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
              <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. WhatsApp</label>
              <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Biaya Pendaftaran</span>
            <span className="text-xl font-bold text-primary-purple">{formatCurrency(session.price_per_person)}</span>
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
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-primary-purple transition-colors bg-gray-50 cursor-pointer relative">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 justify-center">
                  <span className="relative rounded-md font-medium text-primary-purple focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-purple">
                    <span>Upload foto</span>
                    <input type="file" className="sr-only" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </span>
                </div>
                <p className="text-xs text-gray-500">{file ? file.name : 'PNG, JPG up to 5MB'}</p>
              </div>
              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !file || !formData.name}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-purple hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-purple disabled:opacity-50 transition-all"
          >
            {submitting ? 'Memproses...' : 'Daftar & Kirim Pembayaran'}
          </button>
        </form>
      </div>
    </div>
  );
}
