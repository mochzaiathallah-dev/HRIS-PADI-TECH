import React, { useState } from 'react'
import { UserProfile } from '@/types'
import { parseTiktokOrderFile, batchInsertTiktokSessions, ParseTiktokResult } from '@/lib/excelTiktokParser'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileSpreadsheet, 
  UploadCloud, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Zap, 
  User, 
  AtSign
} from 'lucide-react'

interface ImportExcelTiktokModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  hostEmployees: UserProfile[]
  defaultHostId?: string
}

export const ImportExcelTiktokModal: React.FC<ImportExcelTiktokModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hostEmployees,
  defaultHostId,
}) => {
  const [selectedHostId, setSelectedHostId] = useState<string>(
    defaultHostId || (hostEmployees.length > 0 ? hostEmployees[0].id : '')
  )
  const [selectedAccount, setSelectedAccount] = useState<string>('@wangigaya')
  const [excelResult, setExcelResult] = useState<ParseTiktokResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  // Format Rupiah
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsParsing(true)

    try {
      const result = await parseTiktokOrderFile(file, selectedAccount)
      if (!result.success || result.liveSessions.length === 0) {
        throw new Error(result.error || 'Tidak ditemukan data sesi LIVE valid dalam file Excel/CSV ini.')
      }
      setExcelResult(result)
    } catch (err: any) {
      console.error('Error parsing file:', err)
      setErrorMessage(err.message || 'Gagal membaca file Excel/CSV.')
      setExcelResult(null)
    } finally {
      setIsParsing(false)
      e.target.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!excelResult || excelResult.liveSessions.length === 0) {
      setErrorMessage('Pilih file Excel/CSV terlebih dahulu.')
      return
    }

    if (!selectedHostId) {
      setErrorMessage('Pilih Host Live yang bertanggung jawab untuk sesi ini.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await batchInsertTiktokSessions(
        selectedHostId,
        excelResult.liveSessions,
        selectedAccount
      )

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan sesi live ke database.')
      }

      setSuccessMessage(
        `Berhasil mengimpor ${res.insertedCount} sesi live TikTok ke database Supabase! Data langsung sinkron realtime.`
      )

      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error('Import submit error:', err)
      setErrorMessage(err.message || 'Gagal mengimpor data ke database.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetFile = () => {
    setExcelResult(null)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="w-full max-w-xl shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Impor Data TikTok Live (Excel / CSV)
                </CardTitle>
                <CardDescription className="text-xs">
                  Ekstraksi otomatis ekspor pesanan TikTok Shop ke database Supabase secara realtime
                </CardDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Success Banner */}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form Settings: Pilih Host & Akun */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            {/* Host Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-indigo-500" />
                Tetapkan ke Host Live
              </Label>
              <select
                value={selectedHostId}
                onChange={(e) => setSelectedHostId(e.target.value)}
                disabled={isSubmitting}
                className="w-full text-xs h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {hostEmployees.length === 0 ? (
                  <option value="">Belum ada karyawan host</option>
                ) : (
                  hostEmployees.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nama} ({h.role})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Akun TikTok */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5 text-pink-500" />
                Akun TikTok
              </Label>
              <input
                type="text"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                placeholder="@wangigaya"
                disabled={isSubmitting}
                className="w-full text-xs h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
              />
            </div>
          </div>

          {/* File Upload Zone / Parsed Card */}
          {!excelResult ? (
            <div className="relative border-2 border-dashed border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 rounded-xl p-6 text-center transition-all bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40 cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isParsing || isSubmitting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
              {isParsing ? (
                <div className="py-4 flex flex-col items-center space-y-2">
                  <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-pulse">
                    Mengekstrak file Excel/CSV TikTok...
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Menghitung total GMV, agregasi per sesi live & produk terjual
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-11 w-11 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Klik atau Seret File Ekspor Pesanan TikTok Shop ke Sini
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    Mendukung file .xlsx, .xls, dan .csv (contoh: affiliate_orders.xlsx)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Sistem otomatis mengagregasi 50+ baris pesanan menjadi daftar sesi siaran LIVE
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                      {excelResult.fileName}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {excelResult.totalRows} baris diekstrak menjadi {excelResult.liveSessions.length} sesi LIVE
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFile}
                  disabled={isSubmitting}
                  className="h-7 text-xs text-slate-500 hover:text-red-600 gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Ganti File
                </Button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                  <span className="text-[10px] text-muted-foreground block">Total GMV Live</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {formatRupiah(excelResult.totalGMVLive)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                  <span className="text-[10px] text-muted-foreground block">Sesi Live</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {excelResult.liveSessions.length} Sesi
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                  <span className="text-[10px] text-muted-foreground block">Produk Terjual</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {excelResult.liveSessions.reduce((acc, s) => acc + s.produk_terjual, 0)} Pcs
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center">
                  <span className="text-[10px] text-muted-foreground block">Pesanan Live</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {excelResult.totalOrders} Order
                  </span>
                </div>
              </div>

              {/* Daftar Sesi Live Preview */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Pratinjau Sesi Siaran ({excelResult.liveSessions.length} sesi siap diimpor):
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white/70 dark:bg-slate-900/70">
                  {excelResult.liveSessions.map((session, idx) => (
                    <div
                      key={session.contentId || idx}
                      className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/50"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                          #{idx + 1}
                        </Badge>
                        <span className="font-medium">{session.tanggal} {session.waktu}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{session.produk_terjual} Pcs</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(session.gmv_rupiah)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <CardFooter className="pt-3 pb-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Batal
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!excelResult || isSubmitting || !selectedHostId}
            onClick={handleConfirmImport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-md shadow-emerald-600/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyimpan ke Supabase...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Konfirmasi Impor {excelResult ? `${excelResult.liveSessions.length} Sesi` : ''}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
