import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function aiAssistantDevPlugin(): Plugin {
  return {
    name: 'ai-assistant-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/ai-assistant', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })

        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}')
            const prompt = parsed.prompt
            const role = parsed.role || 'tutor'

            if (!prompt || typeof prompt !== 'string') {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Prompt pertanyaan wajib diisi.' }))
              return
            }

            const env = loadEnv('development', process.cwd(), '')
            const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY

            if (!apiKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY belum terkonfigurasi di server .env' }))
              return
            }

            const NO_MARKDOWN_INSTRUCTION = `
ATURAN FORMAT JAWABAN (WAJIB DIIKUTI):
1. JANGAN PERNAH gunakan tanda bintang (**) atau (*) untuk format teks.
2. JANGAN PERNAH gunakan tanda pagar (#, ##, ###) untuk heading/judul.
3. JANGAN PERNAH gunakan garis pemisah (---) atau tanda petik blok (>).
4. Tuliskan jawaban secara langsung dalam teks bersih, alami, ramah, dan mengalir rapi.
5. Gunakan penomoran biasa (1., 2., 3.) untuk daftar poin.
6. Jawab secara lengkap, mendalam, tuntas sampai selesai, dan JANGAN terpotong di tengah kalimat.`

            const SYSTEM_PROMPTS: Record<string, string> = {
              tutor: `Anda adalah Asisten AI Cerdas untuk Tutor Bimbingan Belajar di HRIS PADI TECH. Tugas Anda: membuat soal latihan & kunci jawaban (SD-SMA), menjelaskan materi yang rumit secara sederhana, memberikan ide ice-breaking, dan merumuskan catatan evaluasi siswa. Berikan respon rapi, edukatif, dan ramah.\n${NO_MARKDOWN_INSTRUCTION}`,
              host: `Anda adalah Asisten AI Cerdas untuk Host TikTok Live Commerce di HRIS PADI TECH. Tugas Anda: membuat hook pembuka live 3 detik pertama, menyusun script keranjang kuning persuasif, tips menaikkan retensi & interaksi penonton, dan strategi meningkatkan GMV penjualan. Berikan respon energik dan aplikatif.\n${NO_MARKDOWN_INSTRUCTION}`,
              owner: `Anda adalah Penasihat AI Eksekutif Bisnis untuk Owner di HRIS PADI TECH. Tugas Anda: memberikan analisis strategi omset bimbel & live, KPI evaluasi tim, draf pengumuman resmi perusahaan, dan efisiensi operasional. Berikan respon profesional dan analitis.\n${NO_MARKDOWN_INSTRUCTION}`
            }

            const systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.tutor

            const geminiPayload = {
              contents: [{
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nPertanyaan/Instruksi Pengguna:\n${prompt}` }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192
              }
            }

            const CANDIDATE_MODELS = [
              'gemini-3.5-flash',
              'gemini-3.7-flash',
              'gemini-3.1-flash-lite',
              'gemini-3-flash-preview',
              'gemini-3.8-flash'
            ]

            let answer: string | null = null
            let lastError = ''

            for (const model of CANDIDATE_MODELS) {
              try {
                const response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiPayload)
                  }
                )

                if (response.ok) {
                  const data = (await response.json()) as any
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    answer = text
                    break
                  }
                } else {
                  lastError = await response.text()
                  console.warn(`[Vite AI] Model ${model} returned ${response.status}, trying fallback...`)
                }
              } catch (e: any) {
                lastError = e.message
              }
            }

            if (!answer) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Layanan AI sedang sibuk. Silakan coba kembali sesaat lagi.', details: lastError }))
              return
            }

            // Sanitasi teks agar bersih tanpa asterisks atau hashtags
            const cleanedAnswer = answer
              .replace(/\*\*(.*?)\*\*/g, '$1')
              .replace(/__(.*?)__/g, '$1')
              .replace(/(^|[^\*])\*(?!\s)(.*?)\*(?!\*)/g, '$1$2')
              .replace(/^\*\s+/gm, '• ')
              .replace(/^#{1,6}\s+/gm, '')
              .replace(/^[\-\*_]{3,}\s*$/gm, '')
              .replace(/^>\s+/gm, '')
              .replace(/\$(.*?)\$/g, '$1')
              .trim()

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, answer: cleanedAnswer }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Error processing AI request' }))
          }
        })
      })

      server.middlewares.use('/api/cron-heartbeat', async (_req, res) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          message: 'Local Vite dev heartbeat pulse OK'
        }))
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aiAssistantDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
