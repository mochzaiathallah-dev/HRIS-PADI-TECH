import Papa from 'papaparse'
import { LaporanBimbel, LaporanTiktok } from '@/types'

/**
 * Client-Side CSV Exporter using PapaParse
 * Operates purely in browser with zero server computation
 */

export function exportBimbelToCSV(data: LaporanBimbel[], fileName: string = 'laporan_bimbel.csv') {
  const formattedData = data.map((item, index) => ({
    No: index + 1,
    Tanggal: item.tanggal,
    'Nama Murid': item.murid?.nama || '-',
    Kelas: item.murid?.tingkat_kelas || '-',
    Tutor: item.tutor?.nama || '-',
    'Mata Pelajaran': item.mata_pelajaran,
    Topik: item.topik,
    'Ringkasan Materi': item.ringkasan,
    'Waktu Input': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
  }))

  const csv = Papa.unparse(formattedData)
  downloadBlob(csv, fileName, 'text/csv;charset=utf-8;')
}

export function exportTikTokToCSV(data: LaporanTiktok[], fileName: string = 'laporan_tiktok_live.csv') {
  const formattedData = data.map((item, index) => ({
    No: index + 1,
    Tanggal: item.tanggal,
    Host: item.host?.nama || '-',
    'Durasi (Menit)': item.durasi_menit,
    'GMV (Rupiah)': item.gmv_rupiah,
    'Format GMV': `Rp ${Number(item.gmv_rupiah).toLocaleString('id-ID')}`,
    Tayangan: item.tayangan,
    Impresi: item.impresi,
    'URL Bukti': item.foto_bukti_url || '-',
    'Waktu Input': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
  }))

  const csv = Papa.unparse(formattedData)
  downloadBlob(csv, fileName, 'text/csv;charset=utf-8;')
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob(['\ufeff' + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
