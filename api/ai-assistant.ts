import type { VercelRequest, VercelResponse } from '@vercel/node'

const NO_MARKDOWN_INSTRUCTION = `
ATURAN FORMAT JAWABAN (WAJIB DIIKUTI):
1. JANGAN PERNAH gunakan tanda bintang (**) atau (*) untuk format teks.
2. JANGAN PERNAH gunakan tanda pagar (#, ##, ###) untuk heading/judul.
3. JANGAN PERNAH gunakan garis pemisah (---) atau tanda petik blok (>).
4. Tuliskan jawaban secara langsung dalam teks bersih, alami, ramah, dan mengalir rapi.
5. Gunakan penomoran biasa (1., 2., 3.) untuk daftar poin.
6. Jawab secara lengkap, mendalam, tuntas sampai selesai, dan JANGAN terpotong di tengah kalimat.

FITUR PEMBUATAN GAMBAR AI (GRATIS & UNLIMITED):
Jika pengguna meminta membuat gambar, diagram, ilustrasi, foto, atau visualisasi materi (misalnya: 'buatkan gambar...', 'gambar...', 'ilustrasikan...', 'visualisasikan...', 'generate image', atau materi visual lainnya):
- Anda SANGAT BISA dan MAMPU membuatkan gambar visual melalui AI generator terintegrasi. JANGAN PERNAH menolak dengan alasan 'saya berbasis teks dan tidak bisa mengirim gambar fisik'.
- Berikan penjelasan materi/topik yang diminta dengan ramah dan edukatif.
- Di BARIS PALING AKHIR jawaban Anda, sertakan instruksi prompt gambar berbahasa Inggris yang sangat deskriptif dan detail untuk model visual AI dengan format tepat:
[IMAGE_PROMPT: detailed high-quality English description of the image, clear lighting, educational scientific or professional illustration, 8k resolution]
Contoh:
[IMAGE_PROMPT: educational detailed medical illustration of human internal anatomy organs front view, clear diagram, bright lighting, high resolution, 8k]`

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor: `Anda adalah Asisten AI Cerdas untuk Tutor Bimbingan Belajar di HRIS PADI TECH.
Tugas utama Anda:
1. Membuat soal latihan, kuis interaktif, dan kunci jawaban untuk berbagai jenjang (SD, SMP, SMA) dan mata pelajaran (Matematika, Bahasa Inggris, Sains/IPA, IPS, dll).
2. Menjelaskan konsep materi yang rumit dengan analogi sederhana dan metode belajar yang mudah dipahami siswa.
3. Memberikan ide ice-breaking, tips mengatasi siswa yang bosan atau kesulitan fokus.
4. Membantu merumuskan catatan ringkasan evaluasi perkembangan belajar siswa untuk laporan orang tua.
5. Menghasilkan ilustrasi/gambar visual edukatif jika diminta oleh tutor.
Gaya respon: Terstruktur, ramah, edukatif, rapi tanpa simbol formatting aneh.
${NO_MARKDOWN_INSTRUCTION}`,

  host: `Anda adalah Asisten AI Cerdas untuk Host TikTok Live Commerce di HRIS PADI TECH.
Tugas utama Anda:
1. Membuat hook pembuka live streaming yang menarik perhatian penonton dalam 3 detik pertama.
2. Menyusun script promosi produk (keranjang kuning) yang persuasif, interaktif, dan tidak membosankan.
3. Memberikan strategi meningkatkan retensi penonton, interaksi (komentar, tap love, share).
4. Memberikan tips meningkatkan GMV penjualan dan penawaran waktu terbatas (FOMO/urgensi).
5. Menghasilkan ide visual banner/poster promosi live jika diminta.
Gaya respon: Energik, kreatif, persuasif, aplikatif untuk live streaming TikTok.
${NO_MARKDOWN_INSTRUCTION}`,

  owner: `Anda adalah Penasihat AI Eksekutif Bisnis untuk Owner di HRIS PADI TECH.
Tugas utama Anda:
1. Memberikan analisis strategis dan insight pertumbuhan bisnis Bimbingan Belajar dan TikTok Live Commerce.
2. Membantu formulasi KPI dan evaluasi efektivitas kinerja tutor bimbel dan host live.
3. Menyusun draf pengumuman resmi perusahaan, SOP operasional, dan surat koordinasi tim.
4. Memberikan rekomendasi efisiensi biaya operasional dan optimasi pendapatan (GMV & SPP bimbel).
5. Menghasilkan visual infografis atau diagram strategi jika diminta.
Gaya respon: Profesional, strategis, analitis, ringkas dan berorientasi hasil.
${NO_MARKDOWN_INSTRUCTION}`
}

export function cleanAiResponseText(rawText: string): string {
  if (!rawText) return ''
  return rawText
    // Hapus tanda tebal ganda **text** atau __text__
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Hapus tanda miring atau peluru bintang tunggal
    .replace(/(^|[^\*])\*(?!\s)(.*?)\*(?!\*)/g, '$1$2')
    .replace(/^\*\s+/gm, '• ')
    // Hapus tanda pagar heading (###, ##, #)
    .replace(/^#{1,6}\s+/gm, '')
    // Hapus garis pemisah horizontal (---, ***, ___)
    .replace(/^[\-\*_]{3,}\s*$/gm, '')
    // Hapus tanda quote block (>)
    .replace(/^>\s+/gm, '')
    // Hapus tanda dolar formula ($x$)
    .replace(/\$(.*?)\$/g, '$1')
    .trim()
}

// Simple in-memory rate limiter per IP (prevents flood/DDoS)
const requestLogs = new Map<string, number[]>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  // Rate Limiting: Max 20 requests per minute per IP
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const timestamps = requestLogs.get(clientIp) || []
  const recentTimestamps = timestamps.filter(t => now - t < 60000)

  if (recentTimestamps.length >= 20) {
    return res.status(429).json({
      error: 'Terlalu banyak permintaan (Rate limit tercapai). Silakan tunggu 1 menit.'
    })
  }

  recentTimestamps.push(now)
  requestLogs.set(clientIp, recentTimestamps)

  try {
    const { prompt, role = 'tutor', makeImage = false } = req.body || {}

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt pertanyaan wajib diisi.' })
    }

    if (prompt.length > 3500) {
      return res.status(400).json({ error: 'Pertanyaan terlalu panjang. Maksimal 3500 karakter.' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({
        error: 'API Key AI belum dikonfigurasi di server environment.'
      })
    }

    const systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.tutor

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nPertanyaan/Instruksi dari pengguna:\n${prompt.trim()}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192, // Token tinggi agar jawaban tuntas dan tidak pernah terpotong di tengah
      }
    }

    const CANDIDATE_MODELS = [
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.8-flash'
    ]

    let rawAnswer: string | null = null
    let lastError = ''

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
          }
        )

        if (response.ok) {
          const data = (await response.json()) as any
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            rawAnswer = text
            break
          }
        } else {
          lastError = await response.text()
          console.warn(`Model ${model} returned ${response.status}, trying fallback...`)
        }
      } catch (err: any) {
        lastError = err.message
      }
    }

    if (!rawAnswer) {
      return res.status(502).json({
        error: 'Layanan AI sedang mengalami lonjakan antrean. Silakan coba kembali sesaat lagi.',
        details: lastError
      })
    }

    // 1. Ekstraksi instruksi pembuatan gambar dari AI
    let imageUrl: string | null = null
    let imagePrompt: string | null = null

    const imageMatch = rawAnswer.match(/\[IMAGE_PROMPT:\s*([^\]]+)\]/i)
    if (imageMatch) {
      imagePrompt = imageMatch[1].trim()
      rawAnswer = rawAnswer.replace(/\[IMAGE_PROMPT:\s*([^\]]+)\]/i, '').trim()
    }

    // 2. Deteksi apakah permintaan adalah pembuatan gambar
    const isImageRequest = 
      Boolean(makeImage) ||
      /\b(buatkan\s+gambar|buat\s+gambar|gambarin|bikin\s+gambar|lukiskan|ilustrasikan|visualisasikan|generate\s+image|foto|diagram|anatomi)\b/i.test(prompt)

    if (!imagePrompt && isImageRequest) {
      const cleanPromptForImage = prompt
        .replace(/^(tolong\s+)?(buatkan\s+|bikin\s+|bikinin\s+)?(gambar\s+|ilustrasi\s+|foto\s+|diagram\s+)/i, '')
        .trim()
      imagePrompt = `educational high quality detailed illustration of ${cleanPromptForImage || prompt}, clear lighting, vibrant colors, 8k resolution`
    }

    // 3. Generate URL Pollinations Flux (Gratis, Unlimited, Cepat & Bebas Quota)
    if (imagePrompt) {
      const seed = Math.floor(Math.random() * 1000000)
      imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`
    }

    // Bersihkan semua simbol markdown agar jawaban langsung rapi tanpa bintang atau tanda pagar
    const cleanedAnswer = cleanAiResponseText(rawAnswer)

    return res.status(200).json({
      success: true,
      answer: cleanedAnswer,
      imageUrl,
      imagePrompt
    })
  } catch (error: any) {
    console.error('AI Assistant server error:', error)
    return res.status(500).json({
      error: 'Terjadi kesalahan internal pada server asisten AI.'
    })
  }
}
