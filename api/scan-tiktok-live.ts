import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body || {}

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Foto bukti / screenshot live wajib dikirim dalam format base64.' })
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum terkonfigurasi di server environment Vercel.' })
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
{"durasi_menit":121,"gmv_rupiah":24500,"tayangan":259,"impresi":796,"komentar":109,"produk_terjual":2,"pengikut_baru":0,"akun_tiktok":null}
`

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
      return res.status(502).json({
        error: 'Gagal memindai screenshot TikTok Live. Pastikan foto screenshot jelas.',
        details: lastError
      })
    }

    // Normalisasi angka
    const durasi_menit = Number(resultJson.durasi_menit) || 60
    const gmv_rupiah = Number(resultJson.gmv_rupiah) || 0
    const tayangan = Number(resultJson.tayangan) || 0
    const impresi = Number(resultJson.impresi) || 0
    const komentar = Number(resultJson.komentar) || 0
    const produk_terjual = Number(resultJson.produk_terjual) || 0
    const pengikut_baru = Number(resultJson.pengikut_baru) || 0
    const akun_tiktok = resultJson.akun_tiktok || null

    return res.status(200).json({
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
    })
  } catch (err: any) {
    console.error('OCR Error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error saat OCR' })
  }
}
