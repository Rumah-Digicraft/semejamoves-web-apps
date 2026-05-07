export async function analyzePaymentProof(base64Image: string, mimeType: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;

  const prompt = `Dari screenshot transfer/pembayaran ini, ekstrak informasi berikut dan kembalikan dalam format JSON SAJA tanpa teks lain:
{
  "nominal": <angka nominal transfer, integer>,
  "tanggal": "<tanggal transfer format YYYY-MM-DD>"
}
Jika tidak bisa membaca, kembalikan null untuk field yang tidak terbaca.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return { error: 'Gemini API Error', details: data.error };
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.error('Empty response from Gemini:', data);
      return { error: 'Empty response', details: data };
    }

    // Try to extract JSON using regex in case Gemini adds extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
      // Clean markdown if wrapped in ```json ... ```
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error('Gemini OCR Exception:', error);
    return { error: 'OCR Exception', details: error.message };
  }
}
