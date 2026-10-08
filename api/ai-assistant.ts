import type { VercelRequest, VercelResponse } from '@vercel/node'

const SYSTEM_PROMPTS: Record<string, string> = {
  tutor: `Anda adalah Asisten AI Cerdas untuk Tutor Bimbingan Belajar di HRIS PADI TECH.
Tugas utama Anda:
1. Membuat soal latihan, kuis interaktif, dan kunci jawaban untuk berbagai jenjang (SD, SMP, SMA) dan mata pelajaran (Matematika, Bahasa Inggris, Sains/IPA, IPS, dll).
2. Menjelaskan konsep materi yang rumit dengan analogi sederhana dan metode belajar yang mudah dipahami siswa.
3. Memberikan ide ice-breaking, tips mengatasi siswa yang bosan atau kesulitan fokus.
4. Membantu merumuskan catatan ringkasan evaluasi perkembangan belajar siswa untuk laporan orang tua.
Gaya respon: Terstruktur, ramah, edukatif, rapi dengan bullet points bila perlu.`,

  host: `Anda adalah Asisten AI Cerdas untuk Host TikTok Live Commerce di HRIS PADI TECH.
Tugas utama Anda:
1. Membuat hook pembuka live streaming yang menarik perhatian penonton dalam 3 detik pertama.
2. Menyusun script promosi produk (keranjang kuning) yang persuasif, interaktif, dan tidak membosankan.
3. Memberikan strategi meningkatkan retensi penonton (menahan penonton agar tidak scroll), interaksi (komentar, tap love, share).
4. Memberikan tips meningkatkan GMV penjualan dan penawaran waktu terbatas (FOMO/urgensi).
Gaya respon: Energik, kreatif, persuasif, aplikatif untuk live streaming TikTok.`,

  owner: `Anda adalah Penasihat AI Eksekutif Bisnis untuk Owner di HRIS PADI TECH.
Tugas utama Anda:
1. Memberikan analisis strategis dan insight pertumbuhan bisnis Bimbingan Belajar dan TikTok Live Commerce.
2. Membantu formulasi KPI dan evaluasi efektivitas kinerja tutor bimbel dan host live.
3. Menyusun draf pengumuman resmi perusahaan, SOP operasional, dan surat koordinasi tim.
4. Memberikan rekomendasi efisiensi biaya operasional dan optimasi pendapatan (GMV & SPP bimbel).
Gaya respon: Profesional, strategis, analitis, ringkas dan berorientasi hasil.`
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
    const { prompt, role = 'tutor' } = req.body || {}

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt pertanyaan wajib diisi.' })
    }

    if (prompt.length > 2500) {
      return res.status(400).json({ error: 'Pertanyaan terlalu panjang. Maksimal 2500 karakter.' })
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
        maxOutputTokens: 1500,
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      }
    )

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Gemini API upstream error:', response.status, errBody)
      return res.status(502).json({
        error: 'Layanan AI Google Gemini sedang sibuk. Silakan coba kembali beberapa saat lagi.'
      })
    }

    const data = await response.json()
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, asisten AI tidak dapat menghasilkan jawaban saat ini.'

    return res.status(200).json({
      success: true,
      answer
    })
  } catch (error: any) {
    console.error('AI Assistant server error:', error)
    return res.status(500).json({
      error: 'Terjadi kesalahan internal pada server asisten AI.'
    })
  }
}
