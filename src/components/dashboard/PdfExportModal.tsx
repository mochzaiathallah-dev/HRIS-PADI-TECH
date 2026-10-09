import React, { useState, useEffect } from 'react'
import { LaporanBimbel, Murid } from '@/types'
import { generateStudentReportPDF } from '@/lib/pdfExporter'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileDown, 
  X, 
  GraduationCap, 
  Calendar, 
  User, 
  FileText, 
  Sparkles
} from 'lucide-react'

interface PdfExportModalProps {
  isOpen: boolean
  onClose: () => void
  muridList: Murid[]
  allBimbelReports: LaporanBimbel[]
  preselectedMuridId?: string
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  muridList,
  allBimbelReports,
  preselectedMuridId,
}) => {
  const [selectedMuridId, setSelectedMuridId] = useState<string>(preselectedMuridId || '')
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // e.g. "2026-09"
  )
  const [tutorName, setTutorName] = useState<string>('')
  const [evaluasiText, setEvaluasiText] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (preselectedMuridId) {
      setSelectedMuridId(preselectedMuridId)
    } else if (muridList.length > 0 && !selectedMuridId) {
      setSelectedMuridId(muridList[0].id)
    }
  }, [preselectedMuridId, muridList, selectedMuridId])

  // Filter sessions matching student and selected month
  const filteredSessions = allBimbelReports.filter((report) => {
    const matchMurid = selectedMuridId ? report.murid_id === selectedMuridId : true
    const matchMonth = selectedMonth ? report.tanggal.startsWith(selectedMonth) : true
    return matchMurid && matchMonth
  }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())

  const selectedMurid = muridList.find((m) => m.id === selectedMuridId)

  // Auto-detect tutor name from filtered sessions if available
  useEffect(() => {
    if (filteredSessions.length > 0 && filteredSessions[0].tutor?.nama) {
      setTutorName(filteredSessions[0].tutor.nama)
    }
  }, [filteredSessions])

  // Convert "2026-09" to "September 2026"
  const formatMonthLabel = (monthStr: string) => {
    if (!monthStr) return 'Semua Periode'
    const [year, month] = monthStr.split('-')
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    const mIdx = parseInt(month, 10) - 1
    return `${months[mIdx] || month} ${year}`
  }

  // Generate PDF (Asynchronous untuk memuat foto dokumentasi)
  const handleExportPDF = async () => {
    if (!selectedMurid) {
      setMessage('Silakan pilih data murid terlebih dahulu.')
      return
    }

    if (filteredSessions.length === 0) {
      setMessage(`Tidak ditemukan catatan sesi belajar untuk ${selectedMurid.nama} pada periode ${formatMonthLabel(selectedMonth)}. Anda tetap dapat mengunduh format kosong atau memilih periode lain.`)
    }

    setIsGenerating(true)
    setMessage('Menyiapkan dokumen & memuat foto dokumentasi belajar...')

    try {
      const monthLabel = formatMonthLabel(selectedMonth)
      await generateStudentReportPDF({
        namaSiswa: selectedMurid.nama,
        kelas: selectedMurid.tingkat_kelas,
        tutorNama: tutorName.trim() || 'Tutor Pendamping',
        periodeBulan: monthLabel,
        evaluasiTutor: evaluasiText.trim() || undefined,
        sesiList: filteredSessions,
      })

      setMessage('Dokumen PDF raport beserta foto dokumentasi berhasil dibuat dan diunduh!')
    } catch (err: any) {
      console.error('Error generating PDF:', err)
      setMessage(`Gagal membuat PDF: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Generate Laporan Belajar Siswa (PDF)</CardTitle>
              <CardDescription className="text-xs">
                Format resmi sesuai standar dokumen laporan bulanan
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-5 space-y-4">
          {message && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <span>{message}</span>
            </div>
          )}

          {/* Pilih Murid */}
          <div className="space-y-1.5">
            <Label htmlFor="pdf-murid" className="text-xs font-semibold flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-blue-500" />
              Nama Siswa
            </Label>
            <select
              id="pdf-murid"
              value={selectedMuridId}
              onChange={(e) => setSelectedMuridId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-slate-900"
            >
              <option value="" disabled>-- Pilih Murid --</option>
              {muridList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} ({m.tingkat_kelas})
                </option>
              ))}
            </select>
          </div>

          {/* Grid Periode & Tutor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Periode Bulan */}
            <div className="space-y-1.5">
              <Label htmlFor="pdf-period" className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Periode Bulan
              </Label>
              <Input
                id="pdf-period"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Nama Tutor */}
            <div className="space-y-1.5">
              <Label htmlFor="pdf-tutor" className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-500" />
                Nama Tutor Pendamping
              </Label>
              <Input
                id="pdf-tutor"
                placeholder="Contoh: Nikita Khoirunnisa"
                value={tutorName}
                onChange={(e) => setTutorName(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Ringkasan Sesi Terdeteksi */}
          <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/60 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Sesi Belajar Terpilih:
              </span>
              <Badge variant={filteredSessions.length > 0 ? 'success' : 'outline'} className="text-[10px]">
                {filteredSessions.length} Sesi Terdata
              </Badge>
            </div>
            {filteredSessions.length > 0 ? (
              <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-1 max-h-24 overflow-y-auto">
                {filteredSessions.map((s, idx) => (
                  <li key={s.id || idx}>
                    {s.tanggal}: {s.mata_pelajaran} - <em>{s.topik}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Belum ada laporan sesi pada bulan ini. Dokumen tetap dapat diekspor.
              </p>
            )}
          </div>

          {/* Catatan Evaluasi Perkembangan Belajar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-eval" className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                Catatan Perkembangan Belajar (Opsional)
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Otomatis jika dikosongkan
              </span>
            </div>
            <Textarea
              id="pdf-eval"
              rows={3}
              placeholder={`Sepanjang bulan ${formatMonthLabel(selectedMonth)}, ${selectedMurid?.nama || 'siswa'} telah mengikuti seluruh rangkaian sesi...`}
              value={evaluasiText}
              onChange={(e) => setEvaluasiText(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t p-4 bg-slate-50 dark:bg-slate-900/50">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleExportPDF}
            disabled={isGenerating || !selectedMurid}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs shadow-md shadow-blue-500/20"
          >
            <FileDown className="h-4 w-4" />
            <span>{isGenerating ? 'Membuat PDF...' : 'Unduh Laporan PDF'}</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
