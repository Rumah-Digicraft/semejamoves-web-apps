const GEMINI_MODEL = 'gemini-2.5-flash';

const PROMPT = `Kamu adalah sistem OCR untuk bukti pembayaran Indonesia. Ekstrak data dari gambar ini dan kembalikan JSON SAJA, tanpa penjelasan, tanpa markdown.

Format output:
{"nominal": <integer>, "tanggal": "<YYYY-MM-DD>"}

Aturan ekstraksi:
- nominal: cari angka yang merepresentasikan jumlah transfer/pembayaran. Format angka Indonesia pakai titik sebagai pemisah ribuan (contoh: "15.000" = 15000, "1.500.000" = 1500000). Abaikan biaya admin/fee.
- tanggal: cari tanggal transaksi. Konversi ke format YYYY-MM-DD. Format umum: "16 Mei 2026", "16/05/2026", "2026-05-16", "16 May 2026".

Bank/e-wallet yang umum (kenali label berikut):
- BCA Mobile: "Nominal Transfer", "Total Transfer"
- GoPay/Gopay: "Total", "Jumlah"
- DANA: "Total Pembayaran", "Nominal"
- OVO: "Jumlah Pembayaran"
- ShopeePay: "Total Pembayaran"
- BNI/BRI/Mandiri/BSI: "Nominal", "Jumlah Transfer", "Amount"
- QRIS: "Total", "Nominal Pembayaran"

Jika field tidak terbaca, isi null. Contoh output: {"nominal": 15000, "tanggal": "2026-05-16"}`;

export async function analyzePaymentProof(base64Image: string, mimeType: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64Image } }] }],
        generationConfig: { maxOutputTokens: 64, temperature: 0 }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return null;
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    return JSON.parse(text);
  } catch (error: any) {
    console.error('Gemini OCR Exception:', error);
    return null;
  }
}
