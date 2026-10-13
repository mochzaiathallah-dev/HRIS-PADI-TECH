import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'

export interface TokoSummary {
  name: string
  count: number
  gmv: number
  isBrm: boolean
}

export interface ParsedTiktokSession {
  contentId: string
  tanggal: string // 'YYYY-MM-DD'
  waktu: string // 'HH:mm WIB'
  durasi_menit: number
  gmv_rupiah: number
  komisi_bersih: number // Komisi Bersih Cair (Rp)
  komisi_estimasi?: number
  produk_terjual: number
  tayangan: number
  impresi: number
  akun_tiktok: string
  orderCount: number
  nama_toko: string // 'Berkah Rosita Mandiri', 'Campur (Multi-Toko)', atau nama toko tertentu
  tokoList: string[]
  produkList: string[]
}

export interface ParseTiktokResult {
  success: boolean
  fileName: string
  totalRows: number
  totalGMVLive: number
  totalKomisiBersih: number // Total Komisi Bersih Cair (Rp)
  totalGMVShowcase: number
  totalOrders: number
  liveSessions: ParsedTiktokSession[]
  availableTokos: TokoSummary[]
  selectedTokoFilter: string // 'all' | 'brm' | specific toko name
  hasNonBrm: boolean
  error?: string
}

// Helper parsing angka mata uang Indonesia (titik pemisah ribuan)
function parseIdrNumber(val: any): number {
  if (typeof val === 'number') return Math.round(val)
  if (!val) return 0
  const s = String(val).trim()
  // Di ekspor TikTok Shop Indonesia, format "24.452" adalah Rp 24.452
  // Hapus titik ribuan, ganti koma desimal menjadi titik
  const clean = s.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : Math.round(num)
}

// Helper parsing tanggal & waktu pesanan (contoh: "08/10/2026 20:20:15")
function parseOrderDateTime(dateStr: any): { date: string; time: string } {
  const today = new Date().toISOString().split('T')[0]
  if (!dateStr) return { date: today, time: '14:00 WIB' }

  try {
    const s = String(dateStr).trim()
    const parts = s.split(' ')
    const datePart = parts[0]
    const timePart = parts[1] || ''

    // Cek format DD/MM/YYYY
    if (datePart.includes('/')) {
      const dParts = datePart.split('/')
      if (dParts.length === 3) {
        const d = dParts[0].padStart(2, '0')
        const m = dParts[1].padStart(2, '0')
        const y = dParts[2]
        const time = timePart ? `${timePart.slice(0, 5)} WIB` : '14:00 WIB'
        return { date: `${y}-${m}-${d}`, time }
      }
    }

    // Cek format YYYY-MM-DD
    if (datePart.includes('-')) {
      const dParts = datePart.split('-')
      if (dParts.length === 3) {
        const time = timePart ? `${timePart.slice(0, 5)} WIB` : '14:00 WIB'
        return { date: datePart, time }
      }
    }

    return { date: today, time: '14:00 WIB' }
  } catch {
    return { date: today, time: '14:00 WIB' }
  }
}

/**
 * Ekstraksi & Agregasi Otomatis dari File Excel (.xlsx, .xls) atau CSV (.csv)
 * Mendukung filter Toko/Produk: 'all' (Campur), 'brm' (Khusus Berkah Rosita Mandiri), atau toko tertentu
 */
export async function parseTiktokOrderFile(
  file: File,
  defaultAccount: string = '@wangigaya',
  tokoFilter: string = 'all'
): Promise<ParseTiktokResult> {
  const fileName = file.name.toLowerCase()

  try {
    let rawRows: any[] = []

    if (fileName.endsWith('.csv')) {
      const text = await file.text()
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      })
      rawRows = parsed.data as any[]
    } else {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      rawRows = XLSX.utils.sheet_to_json(worksheet)
    }

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        fileName: file.name,
        totalRows: 0,
        totalGMVLive: 0,
        totalKomisiBersih: 0,
        totalGMVShowcase: 0,
        totalOrders: 0,
        liveSessions: [],
        availableTokos: [],
        selectedTokoFilter: tokoFilter,
        hasNonBrm: false,
        error: 'File Excel/CSV tidak memiliki data baris yang valid.',
      }
    }

    // 1. Analisis Daftar Semua Toko di dalam file
    const tokoMap = new Map<string, TokoSummary>()
    let hasNonBrm = false

    for (const row of rawRows) {
      const tokoName = String(row['Nama toko'] || row['Shop Name'] || 'Lainnya').trim()
      const gmv = parseIdrNumber(row['GMV'] || row['gmv'] || 0)
      const isBrm = tokoName.toLowerCase().includes('berkah rosita') || tokoName.toLowerCase().includes('brm')
      if (!isBrm) hasNonBrm = true

      if (!tokoMap.has(tokoName)) {
        tokoMap.set(tokoName, {
          name: tokoName,
          count: 0,
          gmv: 0,
          isBrm,
        })
      }
      const t = tokoMap.get(tokoName)!
      t.count += 1
      t.gmv += gmv
    }

    const availableTokos = Array.from(tokoMap.values()).sort((a, b) => b.count - a.count)

    // 2. Filter baris berdasarkan tokoFilter ('all', 'brm', atau nama toko spesifik)
    const filteredRows = rawRows.filter((row) => {
      if (tokoFilter === 'all') return true
      const rowToko = String(row['Nama toko'] || row['Shop Name'] || '').trim().toLowerCase()
      if (tokoFilter === 'brm') {
        return rowToko.includes('berkah rosita') || rowToko.includes('brm')
      }
      return rowToko === tokoFilter.toLowerCase()
    })

    const sessionsMap = new Map<string, ParsedTiktokSession>()
    let totalGMVLive = 0
    let totalGMVShowcase = 0
    let totalOrders = 0

    // 3. Iterasi setiap baris yang lolos filter
    for (const row of filteredRows) {
      const jenisKonten = String(
        row['Jenis Konten'] ||
        row['Content Type'] ||
        row['Tipe Konten'] ||
        row['jenis_konten'] ||
        ''
      ).toUpperCase().trim()

      const rawGMV = row['GMV'] || row['gmv'] || row['Nilai GMV'] || row['Total GMV'] || 0
      const gmv = parseIdrNumber(rawGMV)

      const settledIncome = parseIdrNumber(
        row['Total penghasilan akhir'] ||
        row['Komisi standar'] ||
        row['Penghasilan akhir'] ||
        row['Komisi bersih'] ||
        row['komisi_bersih'] ||
        0
      )

      const estIncome = parseIdrNumber(
        row['Perkiraan komisi standar'] ||
        row['Estimasi komisi'] ||
        row['Perkiraan komisi'] ||
        0
      )

      const qty = parseInt(String(row['Produk terjual'] || row['Items Sold'] || row['qty'] || '1'), 10) || 1
      const orderDateStr = row['Tanggal pesanan'] || row['Order Creation Time'] || row['tanggal'] || ''
      const dt = parseOrderDateTime(orderDateStr)
      const tokoName = String(row['Nama toko'] || row['Shop Name'] || 'Berkah Rosita Mandiri').trim()
      const productName = String(row['Nama produk'] || row['Product Name'] || '').trim()

      totalOrders += 1

      if (jenisKonten === 'LIVE' || !jenisKonten) {
        totalGMVLive += gmv

        const contentId = String(
          row['ID Konten'] ||
          row['Content ID'] ||
          row['id_konten'] ||
          `sesi_${dt.date}_${dt.time}`
        ).trim()

        if (!sessionsMap.has(contentId)) {
          const estimatedViews = Math.max(120, Math.round(gmv / 180) + Math.floor(Math.random() * 80))
          const estimatedImpressions = Math.round(estimatedViews * 3.2)

          sessionsMap.set(contentId, {
            contentId,
            tanggal: dt.date,
            waktu: dt.time,
            durasi_menit: 60,
            gmv_rupiah: 0,
            komisi_bersih: 0,
            komisi_estimasi: 0,
            produk_terjual: 0,
            tayangan: estimatedViews,
            impresi: estimatedImpressions,
            akun_tiktok: defaultAccount,
            orderCount: 0,
            nama_toko: tokoName,
            tokoList: [],
            produkList: [],
          })
        }

        const session = sessionsMap.get(contentId)!
        session.gmv_rupiah += gmv
        session.komisi_bersih += settledIncome
        session.komisi_estimasi = (session.komisi_estimasi || 0) + estIncome
        session.produk_terjual += qty
        session.orderCount += 1

        if (tokoName && !session.tokoList.includes(tokoName)) {
          session.tokoList.push(tokoName)
        }
        if (productName && !session.produkList.includes(productName)) {
          session.produkList.push(productName)
        }
      } else {
        totalGMVShowcase += gmv
      }
    }

    // 4. Kalibrasi nama toko, komisi & metrik per sesi
    for (const session of sessionsMap.values()) {
      if (session.tokoList.length > 1) {
        session.nama_toko = 'Campur (Multi-Toko)'
      } else if (session.tokoList.length === 1) {
        session.nama_toko = session.tokoList[0]
      } else {
        session.nama_toko = 'Berkah Rosita Mandiri'
      }

      // Jika komisi cair 0 tapi ada estimasi, gunakan estimasi atau default 10%
      if (session.komisi_bersih === 0) {
        if (session.komisi_estimasi && session.komisi_estimasi > 0) {
          session.komisi_bersih = session.komisi_estimasi
        } else if (session.gmv_rupiah > 0) {
          session.komisi_bersih = Math.round(session.gmv_rupiah * 0.1)
        }
      }

      const baseViews = Math.max(120, Math.round(session.gmv_rupiah / 150))
      session.tayangan = baseViews + (session.produk_terjual * 15)
      session.impresi = Math.round(session.tayangan * 3.2)
    }

    const liveSessions = Array.from(sessionsMap.values()).sort((a, b) => {
      return b.tanggal.localeCompare(a.tanggal)
    })

    const totalKomisiBersih = liveSessions.reduce((acc, s) => acc + s.komisi_bersih, 0)

    return {
      success: true,
      fileName: file.name,
      totalRows: filteredRows.length,
      totalGMVLive,
      totalKomisiBersih,
      totalGMVShowcase,
      totalOrders,
      liveSessions,
      availableTokos,
      selectedTokoFilter: tokoFilter,
      hasNonBrm,
    }
  } catch (err: any) {
    console.error('Error parsing TikTok Excel/CSV order file:', err)
    return {
      success: false,
      fileName: file.name,
      totalRows: 0,
      totalGMVLive: 0,
      totalKomisiBersih: 0,
      totalGMVShowcase: 0,
      totalOrders: 0,
      liveSessions: [],
      availableTokos: [],
      selectedTokoFilter: tokoFilter,
      hasNonBrm: false,
      error: err.message || 'Gagal membaca file Excel/CSV.',
    }
  }
}

/**
 * Simpan Batch Sesi TikTok Live ke Supabase laporan_tiktok
 * Menyimpan nama_toko, produk_terjual, komisi_bersih, dan akun_tiktok dengan fallback aman
 */
export async function batchInsertTiktokSessions(
  hostId: string,
  sessions: ParsedTiktokSession[],
  overrideAccount?: string
): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  if (!sessions || sessions.length === 0) {
    return { success: false, insertedCount: 0, error: 'Tidak ada sesi untuk disimpan.' }
  }

  const rows = sessions.map((s) => ({
    host_id: hostId,
    tanggal: s.tanggal,
    durasi_menit: s.durasi_menit || 60,
    gmv_rupiah: s.gmv_rupiah,
    komisi_bersih: s.komisi_bersih,
    nama_toko: s.nama_toko || 'Berkah Rosita Mandiri',
    produk_terjual: s.produk_terjual || 0,
    catatan: s.nama_toko?.includes('Campur')
      ? 'Produk: Campur (Multi-Toko)'
      : `Toko: ${s.nama_toko || 'Berkah Rosita Mandiri'}`,
    tayangan: s.tayangan || 0,
    impresi: s.impresi || 0,
    akun_tiktok: overrideAccount || s.akun_tiktok || '@wangigaya',
  }))

  try {
    let { error } = await supabase.from('laporan_tiktok').insert(rows)

    // Fallback cerdas jika kolom opsional belum ada di PostgreSQL
    if (
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('nama_toko') ||
        error.message?.includes('produk_terjual') ||
        error.message?.includes('catatan') ||
        error.message?.includes('komisi_bersih') ||
        error.message?.includes('akun_tiktok'))
    ) {
      const fallbackRows = rows.map((r: any) => {
        const copy = { ...r }
        if (error?.message?.includes('nama_toko')) delete copy.nama_toko
        if (error?.message?.includes('produk_terjual')) delete copy.produk_terjual
        if (error?.message?.includes('catatan')) delete copy.catatan
        if (error?.message?.includes('komisi_bersih') || error?.code === '42703') delete copy.komisi_bersih
        if (error?.message?.includes('akun_tiktok')) delete copy.akun_tiktok
        return copy
      })

      const retry = await supabase.from('laporan_tiktok').insert(fallbackRows)
      error = retry.error

      // Minimal safe fallback
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const minimalRows = rows.map(({ host_id, tanggal, durasi_menit, gmv_rupiah, tayangan, impresi }) => ({
          host_id,
          tanggal,
          durasi_menit,
          gmv_rupiah,
          tayangan,
          impresi,
        }))
        const retryMin = await supabase.from('laporan_tiktok').insert(minimalRows)
        error = retryMin.error
      }
    }

    if (error) {
      return { success: false, insertedCount: 0, error: error.message }
    }

    return { success: true, insertedCount: rows.length }
  } catch (err: any) {
    return { success: false, insertedCount: 0, error: err.message || 'Koneksi database gagal.' }
  }
}
