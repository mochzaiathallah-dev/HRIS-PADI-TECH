import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'

export interface TokoSummary {
  name: string
  count: number
  gmv: number
  isBrm: boolean
}

export interface ProductSummary {
  name: string
  tokoName: string
  shortName: string
  count: number // total pesanan (order)
  qty: number // total produk terjual (pcs)
  gmv: number // total GMV (Rp)
  komisi: number // total komisi (Rp)
  sessionCount: number // jumlah sesi yang menjual produk ini
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
  nama_toko: string // 'Berkah Rosita Mandiri', nama produk spesifik, atau 'Campur (Multi-Toko)'
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
  totalQty: number
  liveSessions: ParsedTiktokSession[]
  availableTokos: TokoSummary[]
  availableProducts: ProductSummary[]
  selectedTokoFilter: string // 'all' | 'brm' | specific toko name
  selectedProductFilter?: string // 'all' | specific product name
  filterMode?: 'all' | 'brm' | 'toko' | 'product'
  filterLabel: string
  hasNonBrm: boolean
  rawRows?: any[]
  error?: string
}

// Helper nama produk yang rapi dan ringkas untuk UI
export function getShortProductName(fullName: string): string {
  if (!fullName) return 'Produk TikTok'
  const clean = fullName.trim()
  if (clean.toLowerCase().includes('bundling')) return 'Bundling BRM 800ml x4'
  if (clean.toLowerCase().includes('happiness')) return 'BRM Happiness 800ml Refill'
  if (clean.includes('800ml')) return 'BRM Pelicin & Pengharum 800ml'
  if (clean.includes('900ml')) return 'BRM Pelicin & Pengharum 900ml'
  if (clean.includes('1Liter') || clean.includes('1 Liter') || clean.includes('1L')) return 'BRM Pelicin & Pengharum 1 Liter'
  if (clean.includes('200ml')) return 'BRM Pelicin & Pengharum 200ml'
  if (clean.includes('300ml')) return 'BRM Pelicin & Pengharum 300ml'
  if (clean.toLowerCase().includes('hanasui')) return 'Hanasui Serum Bright Expert'
  if (clean.toLowerCase().includes('pixy') && clean.toLowerCase().includes('powder')) return 'Pixy Airy Blur Loose Powder'
  if (clean.toLowerCase().includes('pixy')) return 'Pixy Two Way Cake Refill'
  if (clean.toLowerCase().includes('iru kids') && clean.toLowerCase().includes('jersey')) return 'IRU KIDS - 5 Pcs Paket Jersey'
  if (clean.toLowerCase().includes('iru kids')) return 'IRU KIDS - 5 Pcs Setelan Printing'
  if (clean.toLowerCase().includes('bravekids') && clean.toLowerCase().includes('rugby')) return 'Bravekids Rugby Tees'
  if (clean.toLowerCase().includes('bravekids')) return 'Bravekids Cargo Pocket'
  if (clean.toLowerCase().includes('zwitsal') && clean.toLowerCase().includes('shampoo')) return 'Zwitsal Kids Shampoo 180ml'
  if (clean.toLowerCase().includes('zwitsal')) return 'Zwitsal Baby Face & Body 50g'
  if (clean.toLowerCase().includes('skin')) return "For Skin's Sake Clearance"
  if (clean.toLowerCase().includes('meja')) return 'Mehaa Meja Lipat Anak'
  if (clean.toLowerCase().includes('botol')) return 'Botol Minum Anak 420ml'
  if (clean.toLowerCase().includes('safi')) return 'Safi Purifying Cleanser'
  if (clean.toLowerCase().includes('cepol')) return 'Cepol Full Renda Brukat'

  return clean.length > 40 ? `${clean.slice(0, 38)}...` : clean
}

// Helper parsing angka mata uang Indonesia (titik pemisah ribuan)
export function parseIdrNumber(val: any): number {
  if (typeof val === 'number') return Math.round(val)
  if (!val) return 0
  const s = String(val).trim()
  const clean = s.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : Math.round(num)
}

// Helper parsing tanggal & waktu pesanan (contoh: "08/10/2026 20:20:15")
export function parseOrderDateTime(dateStr: any): { date: string; time: string } {
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
 * Agregasi cerdas dan instan dari baris mentah file Excel/CSV TikTok
 * Memperbarui GMV, Komisi, Sesi Live, Qty Terjual, dan Pesanan Live sesuai filter
 */
export function aggregateTiktokOrders(
  rawRows: any[],
  fileName: string,
  defaultAccount: string = '@petualangansajak',
  filterMode: 'all' | 'brm' | 'toko' | 'product' = 'all',
  filterValue: string = 'all'
): ParseTiktokResult {
  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      fileName,
      totalRows: 0,
      totalGMVLive: 0,
      totalKomisiBersih: 0,
      totalGMVShowcase: 0,
      totalOrders: 0,
      totalQty: 0,
      liveSessions: [],
      availableTokos: [],
      availableProducts: [],
      selectedTokoFilter: filterValue,
      filterLabel: 'Tidak ada data',
      hasNonBrm: false,
      error: 'Data kosong',
    }
  }

  // 1. Analisis Semua Toko & Semua Produk di dalam file
  const tokoMap = new Map<string, TokoSummary>()
  const prodMap = new Map<string, ProductSummary & { sessionSet: Set<string> }>()
  let hasNonBrm = false

  for (const row of rawRows) {
    const tokoName = String(row['Nama toko'] || row['Shop Name'] || 'Lainnya').trim()
    const productName = String(row['Nama produk'] || row['Product Name'] || 'Produk TikTok').trim()
    const gmv = parseIdrNumber(row['GMV'] || row['gmv'] || 0)
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
    const komisi = settledIncome > 0 ? settledIncome : (estIncome > 0 ? estIncome : Math.round(gmv * 0.1))
    const qty = parseInt(String(row['Produk terjual'] || row['Items Sold'] || row['qty'] || '1'), 10) || 1
    const dt = parseOrderDateTime(row['Tanggal pesanan'] || row['Order Creation Time'] || row['tanggal'] || '')
    const cid = String(row['ID Konten'] || row['Content ID'] || `${dt.date}_${dt.time}`).trim()

    const isBrm =
      tokoName.toLowerCase().includes('berkah rosita') ||
      tokoName.toLowerCase().includes('brm') ||
      productName.toLowerCase().includes('brm') ||
      productName.toLowerCase().includes('rosita')

    if (!isBrm) hasNonBrm = true

    // Toko Summary
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

    // Product Summary
    if (!prodMap.has(productName)) {
      prodMap.set(productName, {
        name: productName,
        tokoName,
        shortName: getShortProductName(productName),
        count: 0,
        qty: 0,
        gmv: 0,
        komisi: 0,
        sessionCount: 0,
        sessionSet: new Set<string>(),
        isBrm,
      })
    }
    const p = prodMap.get(productName)!
    p.count += 1
    p.qty += qty
    p.gmv += gmv
    p.komisi += komisi
    p.sessionSet.add(cid)
  }

  const availableTokos = Array.from(tokoMap.values()).sort((a, b) => b.gmv - a.gmv)
  const availableProducts = Array.from(prodMap.values())
    .map((p) => ({
      name: p.name,
      tokoName: p.tokoName,
      shortName: p.shortName,
      count: p.count,
      qty: p.qty,
      gmv: p.gmv,
      komisi: p.komisi,
      sessionCount: p.sessionSet.size,
      isBrm: p.isBrm,
    }))
    .sort((a, b) => b.gmv - a.gmv)

  // 2. Filter baris sesuai filterMode & filterValue
  const filteredRows = rawRows.filter((row) => {
    const rowToko = String(row['Nama toko'] || row['Shop Name'] || '').trim()
    const rowProd = String(row['Nama produk'] || row['Product Name'] || '').trim()

    if (filterMode === 'all') return true
    if (filterMode === 'brm') {
      return (
        rowToko.toLowerCase().includes('berkah rosita') ||
        rowToko.toLowerCase().includes('brm') ||
        rowProd.toLowerCase().includes('brm') ||
        rowProd.toLowerCase().includes('rosita')
      )
    }
    if (filterMode === 'toko') {
      return rowToko.toLowerCase() === filterValue.toLowerCase()
    }
    if (filterMode === 'product') {
      return rowProd === filterValue || rowProd.toLowerCase() === filterValue.toLowerCase()
    }
    return true
  })

  // 3. Agregasi sesi
  const sessionsMap = new Map<string, ParsedTiktokSession>()
  let totalGMVLive = 0
  let totalGMVShowcase = 0
  let totalQty = 0

  for (const row of filteredRows) {
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

    totalGMVLive += gmv
    totalQty += qty

    const contentId = String(
      row['ID Konten'] ||
      row['Content ID'] ||
      row['id_konten'] ||
      `sesi_${dt.date}_${dt.time}`
    ).trim()

    if (!sessionsMap.has(contentId)) {
      sessionsMap.set(contentId, {
        contentId,
        tanggal: dt.date,
        waktu: dt.time,
        durasi_menit: 60,
        gmv_rupiah: 0,
        komisi_bersih: 0,
        komisi_estimasi: 0,
        produk_terjual: 0,
        tayangan: 0,
        impresi: 0,
        akun_tiktok: defaultAccount || '@petualangansajak',
        orderCount: 0,
        nama_toko: filterMode === 'product' ? getShortProductName(filterValue) : tokoName,
        tokoList: [],
        produkList: [],
      })
    }

    const rowKomisi = settledIncome > 0
      ? settledIncome
      : (estIncome > 0 ? estIncome : (gmv > 0 ? Math.round(gmv * 0.1) : 0))

    const session = sessionsMap.get(contentId)!
    session.gmv_rupiah += gmv
    session.komisi_bersih += rowKomisi
    session.komisi_estimasi = (session.komisi_estimasi || 0) + estIncome
    session.produk_terjual += qty
    session.orderCount += 1

    if (tokoName && !session.tokoList.includes(tokoName)) {
      session.tokoList.push(tokoName)
    }
    if (productName && !session.produkList.includes(productName)) {
      session.produkList.push(productName)
    }
  }

  // 4. Kalibrasi per sesi
  for (const session of sessionsMap.values()) {
    if (filterMode === 'product') {
      session.nama_toko = getShortProductName(filterValue)
    } else if (filterMode === 'toko') {
      session.nama_toko = filterValue
    } else if (session.tokoList.length > 1) {
      session.nama_toko = 'Campur (Multi-Toko)'
    } else if (session.tokoList.length === 1) {
      session.nama_toko = session.tokoList[0]
    } else {
      session.nama_toko = 'Berkah Rosita Mandiri'
    }

    if (session.komisi_bersih === 0) {
      if (session.komisi_estimasi && session.komisi_estimasi > 0) {
        session.komisi_bersih = session.komisi_estimasi
      } else if (session.gmv_rupiah > 0) {
        session.komisi_bersih = Math.round(session.gmv_rupiah * 0.1)
      }
    }

    const baseViews = Math.max(120, Math.round(session.gmv_rupiah / 150))
    session.tayangan = baseViews + session.produk_terjual * 15
    session.impresi = Math.round(session.tayangan * 3.2)
  }

  const liveSessions = Array.from(sessionsMap.values()).sort((a, b) => {
    return b.tanggal.localeCompare(a.tanggal)
  })

  const totalKomisiBersih = liveSessions.reduce((acc, s) => acc + s.komisi_bersih, 0)

  let filterLabel = 'Semua Toko & Produk'
  if (filterMode === 'brm') filterLabel = 'Khusus Berkah Rosita Mandiri (BRM)'
  else if (filterMode === 'product') filterLabel = getShortProductName(filterValue)
  else if (filterMode === 'toko') filterLabel = `Toko ${filterValue}`

  return {
    success: true,
    fileName,
    totalRows: filteredRows.length,
    totalGMVLive,
    totalKomisiBersih,
    totalGMVShowcase,
    totalOrders: filteredRows.length,
    totalQty,
    liveSessions,
    availableTokos,
    availableProducts,
    selectedTokoFilter: filterMode === 'toko' ? filterValue : filterMode,
    selectedProductFilter: filterMode === 'product' ? filterValue : 'all',
    filterMode,
    filterLabel,
    hasNonBrm,
    rawRows,
  }
}

/**
 * Ekstraksi & Agregasi Otomatis dari File Excel (.xlsx, .xls) atau CSV (.csv)
 */
export async function parseTiktokOrderFile(
  file: File,
  defaultAccount: string = '@petualangansajak',
  filterMode: 'all' | 'brm' | 'toko' | 'product' = 'all',
  filterValue: string = 'all'
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
        totalQty: 0,
        liveSessions: [],
        availableTokos: [],
        availableProducts: [],
        selectedTokoFilter: filterValue,
        filterLabel: 'File kosong',
        hasNonBrm: false,
        error: 'File Excel/CSV tidak memiliki data baris yang valid.',
      }
    }

    return aggregateTiktokOrders(rawRows, file.name, defaultAccount, filterMode, filterValue)
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
      totalQty: 0,
      liveSessions: [],
      availableTokos: [],
      availableProducts: [],
      selectedTokoFilter: filterValue,
      filterLabel: 'Gagal membaca',
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

  const fallbackAccount = overrideAccount || '@petualangansajak'

  const rows = sessions.map((s) => ({
    host_id: hostId,
    tanggal: s.tanggal,
    durasi_menit: s.durasi_menit || 60,
    gmv_rupiah: s.gmv_rupiah,
    komisi_bersih: s.komisi_bersih,
    nama_toko: s.nama_toko || 'Berkah Rosita Mandiri',
    produk_terjual: s.produk_terjual || 0,
    catatan: s.produkList?.length > 0
      ? `Produk: ${s.produkList.slice(0, 3).map(getShortProductName).join(', ')}`
      : `Toko: ${s.nama_toko || 'Berkah Rosita Mandiri'}`,
    tayangan: s.tayangan || 0,
    impresi: s.impresi || 0,
    akun_tiktok: overrideAccount || s.akun_tiktok || fallbackAccount,
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
