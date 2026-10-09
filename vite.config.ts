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
            const makeImage = Boolean(parsed.makeImage)

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
6. Jawab secara lengkap, mendalam, tuntas sampai selesai, dan JANGAN terpotong di tengah kalimat.

ATURAN PEMBUATAN GAMBAR (SANGAT KETAT):
- HANYA DAN HANYA JIKA pengguna secara spesifik meminta gambar, foto, atau diagram (misalnya ada kata 'buatkan gambar', 'gambarkan', 'bikinkan gambar', 'lukiskan', 'ilustrasikan', 'diagram'):
  Berikan penjelasan materi edukatif terlebih dahulu, lalu di BARIS PALING AKHIR jawaban sertakan instruksi prompt gambar:
  [IMAGE_PROMPT: detailed high-quality English description of the image, educational clean illustration, 8k resolution]
- JIKA pengguna HANYA bertanya materi, teks biasa, surah/ayat, tafsir, rumus, soal latihan, atau TIDAK meminta gambar secara eksplisit:
  DILARANG KERAS membuat gambar, DILARANG menawarkan ilustrasi visual, DILARANG menulis pengantar visual ('berikut adalah ilustrasi visual...'), dan DILARANG menyertakan tag [IMAGE_PROMPT: ...]. Jawab teks pertanyaan pengguna sampai tuntas tanpa embel-embel gambar!`

            const SYSTEM_PROMPTS: Record<string, string> = {
              tutor: `Anda adalah Asisten AI Cerdas untuk Tutor Bimbingan Belajar di HRIS PADI TECH. Tugas Anda: membuat soal latihan & kunci jawaban (SD-SMA), menjelaskan materi yang rumit secara sederhana, memberikan ide ice-breaking, merumuskan catatan evaluasi siswa, dan menghasilkan ilustrasi visual materi pembelajaran.\n${NO_MARKDOWN_INSTRUCTION}`,
              host: `Anda adalah Asisten AI Cerdas untuk Host TikTok Live Commerce di HRIS PADI TECH. Tugas Anda: membuat hook pembuka live 3 detik pertama, menyusun script keranjang kuning persuasif, tips menaikkan retensi & interaksi penonton, strategi meningkatkan GMV penjualan, dan menghasilkan ide visual poster promosi live.\n${NO_MARKDOWN_INSTRUCTION}`,
              owner: `Anda adalah Penasihat AI Eksekutif Bisnis untuk Owner di HRIS PADI TECH. Tugas Anda: memberikan analisis strategi omset bimbel & live, KPI evaluasi tim, draf pengumuman resmi perusahaan, efisiensi operasional, dan menghasilkan diagram strategi visual.\n${NO_MARKDOWN_INSTRUCTION}`
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

            // 1. Ekstraksi instruksi pembuatan gambar dari AI
            let imageUrl: string | null = null
            let imagePrompt: string | null = null
            let generatorEngine = 'Visual AI Free Engine'

            const imageMatch = answer.match(/\[IMAGE_PROMPT:\s*([^\]]+)\]/i)
            if (imageMatch) {
              imagePrompt = imageMatch[1].trim()
              answer = answer.replace(/\[IMAGE_PROMPT:\s*([^\]]+)\]/i, '').trim()
            }

            // 2. Deteksi apakah permintaan adalah pembuatan gambar secara eksplisit
            const isImageExplicitlyRequested = 
              Boolean(makeImage) ||
              /\b(buatkan\s+gambar|buat\s+gambar|gambarin|bikin\s+gambar|lukiskan|ilustrasikan|visualisasikan|generate\s+image|minta\s+gambar|tolong\s+gambar|bikinin\s+gambar|desainkan\s+gambar)\b/i.test(prompt)

            if (!isImageExplicitlyRequested) {
              imagePrompt = null
              imageUrl = null
              answer = answer
                .replace(/\[IMAGE_PROMPT:\s*([^\]]+)\]/gi, '')
                .replace(/(?:Untuk\s+membantu\s+visualisasi[^\n]*\n?)/gi, '')
                .replace(/(?:Berikut\s+(?:adalah\s+)?ilustrasi\s+visual[^\n]*\n?)/gi, '')
                .trim()
            } else {
              if (!imagePrompt) {
                const cleanPromptForImage = prompt
                  .replace(/^(tolong\s+)?(buatkan\s+|bikin\s+|bikinin\s+)?(gambar\s+|ilustrasi\s+|foto\s+|diagram\s+)/i, '')
                  .trim()
                imagePrompt = `clean 2D scientific medical textbook diagram of ${cleanPromptForImage || prompt}, white clean background, educational vector illustration, sharp clear lines, labeled diagram`
              }

              // 3. Eksekusi Pembuatan Gambar: Coba Google Nano Banana Pro lalu fallback ke Visual Engine
              const BANANA_MODELS = ['gemini-3-pro-image', 'gemini-2.5-flash-image', 'gemini-3.1-flash-image']
              let bananaFound = false

              for (const bModel of BANANA_MODELS) {
                try {
                  const bRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${bModel}:generateContent?key=${apiKey}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contents: [{ parts: [{ text: imagePrompt }] }] })
                    }
                  )
                  if (bRes.ok) {
                    const bData = (await bRes.json()) as any
                    const inlinePart = bData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
                    if (inlinePart?.inlineData?.data) {
                      const mime = inlinePart.inlineData.mimeType || 'image/jpeg'
                      imageUrl = `data:${mime};base64,${inlinePart.inlineData.data}`
                      generatorEngine = bModel.includes('3-pro') ? 'Nano Banana Pro' : 'Nano Banana'
                      bananaFound = true
                      break
                    }
                  }
                } catch {
                  // Fallback
                }
              }

              if (!bananaFound) {
                let refinedPrompt = imagePrompt
                const isScientific = /\b(anatomy|organ|internal|body|biology|cell|heart|lung|reproduction|reproduksi|diagram|sains|ipa|biologi)\b/i.test(imagePrompt)
                if (isScientific) {
                  refinedPrompt = `clean 2D scientific medical textbook diagram of ${imagePrompt}, anatomical chart, white clean background, educational vector illustration, sharp clear lines, labeled biological diagram, professional textbook graphic, no blurry 3D`
                }
                const seed = Math.floor(Math.random() * 1000000)
                imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(refinedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`
              }
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
            res.end(JSON.stringify({ 
              success: true, 
              answer: cleanedAnswer,
              imageUrl,
              imagePrompt,
              generatorEngine
            }))
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

      server.middlewares.use('/api/scan-tiktok-live', async (req, res) => {
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
            const { imageBase64, mimeType = 'image/jpeg' } = parsed

            if (!imageBase64 || typeof imageBase64 !== 'string') {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Foto bukti / screenshot live wajib dikirim dalam format base64.' }))
              return
            }

            const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
            const env = loadEnv('development', process.cwd(), '')
            const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY

            if (!apiKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY belum terkonfigurasi di server .env' }))
              return
            }

            const prompt = `Anda adalah asisten AI OCR khusus membaca screenshot rangkuman akhir sesi TikTok Live (End Screen LIVE / Pusat LIVE).
Tugas Anda adalah mengekstrak data metrik performa live streaming secara tepat dan akurat dari screenshot ini ke dalam format JSON murni.

Metrik yang harus diekstrak:
1. durasi_menit: Total durasi live dalam satuan menit (angka bulat integer).
   - Contoh: "2 jam 1 mnt" -> (2 * 60) + 1 = 121
   - Contoh: "1 jam 45 menit" -> (1 * 60) + 45 = 105
   - Contoh: "58 mnt" -> 58
   - Jika tidak ditemukan, default 60
2. gmv_rupiah: Total GMV penjualan / GMV Teratribusi dalam Rupiah (angka bulat integer tanpa titik/koma/simbol).
   - "Rp24,5rb" -> 24500 (rb = ribu / 1.000)
   - "Rp 1,2jt" -> 1200000 (jt = juta / 1.000.000)
   - "Rp500.000" -> 500000
   - Jika 0 atau tidak ada, default 0
3. tayangan: Jumlah tayangan penonton (angka bulat integer). Contoh: "259" -> 259
4. impresi: Jumlah impresi LIVE / interaksi (angka bulat integer). Contoh: "796" -> 796
5. komentar: Jumlah komentar selama live (angka integer). Contoh: "109" -> 109
6. produk_terjual: Jumlah produk terjual teratribusi (angka integer). Contoh: "2" -> 2
7. pengikut_baru: Jumlah pengikut baru (angka integer). Contoh: "0" -> 0
8. akun_tiktok: Nama akun/handle TikTok jika terbaca di screenshot (misal: "@wangigaya" atau "wangigaya"), jika tidak ada biarkan null.

ATURAN OUTPUT:
Hanya kembalikan JSON valid tanpa markdown, tanpa tanda bintang, tanpa backticks:
{"durasi_menit":121,"gmv_rupiah":24500,"tayangan":259,"impresi":796,"komentar":109,"produk_terjual":2,"pengikut_baru":0,"akun_tiktok":null}`

            const CANDIDATE_MODELS = [
              'gemini-3.5-flash',
              'gemini-3.7-flash',
              'gemini-3.1-flash-lite',
              'gemini-3-flash-preview',
              'gemini-3.8-flash',
              'gemini-1.5-flash',
              'gemini-2.0-flash'
            ]

            let resultJson: any = null
            let lastError = ''

            for (const model of CANDIDATE_MODELS) {
              try {
                const response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{
                        parts: [
                          { text: prompt },
                          {
                            inlineData: {
                              mimeType: mimeType.includes('png') ? 'image/png' : 'image/jpeg',
                              data: cleanBase64
                            }
                          }
                        ]
                      }],
                      generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                      }
                    })
                  }
                )

                if (response.ok) {
                  const resData = (await response.json()) as any
                  const text = resData.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    try {
                      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                      resultJson = JSON.parse(cleanText)
                      break
                    } catch (jsonErr) {
                      console.warn(`JSON parse error on model ${model}:`, jsonErr)
                    }
                  }
                } else {
                  lastError = await response.text()
                }
              } catch (err: any) {
                lastError = err.message
              }
            }

            if (!resultJson) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                error: 'Gagal memindai screenshot TikTok Live. Pastikan foto screenshot jelas.',
                details: lastError
              }))
              return
            }

            const durasi_menit = Number(resultJson.durasi_menit) || 60
            const gmv_rupiah = Number(resultJson.gmv_rupiah) || 0
            const tayangan = Number(resultJson.tayangan) || 0
            const impresi = Number(resultJson.impresi) || 0
            const komentar = Number(resultJson.komentar) || 0
            const produk_terjual = Number(resultJson.produk_terjual) || 0
            const pengikut_baru = Number(resultJson.pengikut_baru) || 0
            const akun_tiktok = resultJson.akun_tiktok || null

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              data: {
                durasi_menit,
                gmv_rupiah,
                tayangan,
                impresi,
                komentar,
                produk_terjual,
                pengikut_baru,
                akun_tiktok
              }
            }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Error processing OCR scan' }))
          }
        })
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
