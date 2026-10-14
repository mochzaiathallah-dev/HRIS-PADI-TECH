import React, { useState, useEffect } from 'react'
import { UserProfile } from '@/types'
import { 
  parseTiktokOrderFile, 
  batchInsertTiktokSessions, 
  aggregateTiktokOrders,
  ParseTiktokResult
} from '@/lib/excelTiktokParser'
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
  AtSign,
  Store,
  Filter,
  Package,
  Sparkles
} from 'lucide-react'

interface ImportExcelTiktokModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  hostEmployees: UserProfile[]
  defaultHostId?: string
  defaultAccount?: string
  hostAccounts?: string[]
}

export const ImportExcelTiktokModal: React.FC<ImportExcelTiktokModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hostEmployees,
  defaultHostId,
  defaultAccount = '@petualangansajak',
  hostAccounts = [],
}) => {
  const [selectedHostId, setSelectedHostId] = useState<string>(
    defaultHostId || (hostEmployees.length > 0 ? hostEmployees[0].id : '')
  )
  const [selectedAccount, setSelectedAccount] = useState<string>(defaultAccount)
  const [filterMode, setFilterMode] = useState<'all' | 'brm' | 'toko' | 'product'>('all')
  const [filterValue, setFilterValue] = useState<string>('all')
  const [excelResult, setExcelResult] = useState<ParseTiktokResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (defaultAccount) {
      setSelectedAccount(defaultAccount)
    }
  }, [defaultAccount])

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

    setFilterMode('all')
    setFilterValue('all')
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsParsing(true)

    try {
      const result = await parseTiktokOrderFile(file, selectedAccount, 'all', 'all')
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

  // Terapkan filter produk atau toko secara instan dan reaktif (0 ms)
  const handleApplyFilter = (mode: 'all' | 'brm' | 'toko' | 'product', value: string) => {
    if (!excelResult?.rawRows || excelResult.rawRows.length === 0) return

    setFilterMode(mode)
    setFilterValue(value)
    setErrorMessage(null)

    try {
      const updated = aggregateTiktokOrders(
        excelResult.rawRows,
        excelResult.fileName,
        selectedAccount,
        mode,
        value
      )
      setExcelResult(updated)
    } catch (err: any) {
      console.error('Filter apply error:', err)
      setErrorMessage(err.message || 'Gagal menerapkan filter produk.')
    }
  }

  const handleConfirmImport = async () => {
    if (!excelResult || excelResult.liveSessions.length === 0) {
      setErrorMessage('Pilih file Excel/CSV atau filter produk yang memiliki sesi siaran live terlebih dahulu.')
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
        `Berhasil mengimpor ${res.insertedCount} sesi live TikTok (${excelResult.filterLabel}) ke database Supabase! Data langsung sinkron realtime.`
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
    setFilterMode('all')
    setFilterValue('all')
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
                  Ekstraksi pesanan TikTok Shop: pilih produk BRM saja, produk spesifik, atau campur ke database Supabase
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

          {/* Form Settings: Pilih Host & Akun TikTok */}
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
                  <option value="">Host Saat Ini</option>
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
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  placeholder="@petualangansajak"
                  disabled={isSubmitting}
                  className="w-full text-xs h-9 px-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
              </div>
              {hostAccounts.length > 1 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {hostAccounts.map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => setSelectedAccount(acc)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono border transition-all ${
                        selectedAccount === acc
                          ? 'bg-pink-100 text-pink-700 border-pink-300 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              )}
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
                    Menghitung total GMV, komisi, agregasi per sesi live & produk terjual
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
                    Mendukung file .xlsx, .xls, dan .csv (contoh: affiliate_orders_...Petualangansajak.xlsx)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Otomatis mengenali produk Berkah Rosita Mandiri (800ml, 900ml, 1L, dll) maupun produk toko lain
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100 truncate max-w-[280px]">
                      {excelResult.fileName}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {excelResult.rawRows?.length || excelResult.totalRows} baris pesanan • {excelResult.liveSessions.length} sesi siaran LIVE
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFile}
                  disabled={isSubmitting}
                  className="h-7 text-xs text-slate-500 hover:text-red-600 gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Ganti File
                </Button>
              </div>

              {/* OPSI PILIHAN FILTER PRODUK / TOKO */}
              <div className="space-y-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                {/* Header Filter */}
                <div className="flex items-center justify-between flex-wrap gap-1 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                    Pilihan Produk / Toko yang Disimpan:
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 truncate max-w-[240px]">
                    Filter Aktif: {excelResult.filterLabel}
                  </Badge>
                </div>

                {/* Baris 1: Tab Kategori Master */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyFilter('all', 'all')}
                    disabled={isParsing || isSubmitting}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterMode === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    <span>🌟 Semua Produk & Toko (Campur)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyFilter('brm', 'brm')}
                    disabled={isParsing || isSubmitting}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterMode === 'brm'
                        ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-rose-400'
                    }`}
                  >
                    <span>🔴 Khusus Semua Varian BRM</span>
                  </button>
                </div>

                {/* Baris 2: Quick Product Pills (Pilihan Cepat Produk Unggulan) */}
                {excelResult.availableProducts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      Pilih Cepat Produk Unggulan:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {excelResult.availableProducts.slice(0, 5).map((prod) => {
                        const isSelected = filterMode === 'product' && filterValue === prod.name
                        return (
                          <button
                            key={prod.name}
                            type="button"
                            onClick={() => handleApplyFilter('product', prod.name)}
                            disabled={isParsing || isSubmitting}
                            className={`text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50'
                            }`}
                          >
                            <span>{prod.shortName}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                              isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {prod.sessionCount} Sesi • {formatRupiah(prod.gmv)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Baris 3: Dropdowns untuk Pilih Produk Spesifik & Toko Spesifik */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {/* Dropdown Semua Produk */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Package className="h-3 w-3 text-indigo-500" />
                      Pilih Produk Spesifik ({excelResult.availableProducts.length} Produk):
                    </label>
                    <select
                      value={filterMode === 'product' ? filterValue : ''}
                      onChange={(e) => {
                        if (e.target.value) handleApplyFilter('product', e.target.value)
                      }}
                      disabled={isParsing || isSubmitting}
                      className="w-full text-xs h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Pilih Produk Spesifik --</option>
                      {excelResult.availableProducts.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.isBrm ? '🔴 [BRM] ' : '🛍️ '} {p.shortName} — {formatRupiah(p.gmv)} ({p.qty} pcs • {p.sessionCount} sesi)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown Toko Spesifik */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Store className="h-3 w-3 text-emerald-500" />
                      Pilih Toko Spesifik ({excelResult.availableTokos.length} Toko):
                    </label>
                    <select
                      value={filterMode === 'toko' ? filterValue : ''}
                      onChange={(e) => {
                        if (e.target.value) handleApplyFilter('toko', e.target.value)
                      }}
                      disabled={isParsing || isSubmitting}
                      className="w-full text-xs h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- Pilih Toko Spesifik --</option>
                      {excelResult.availableTokos.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.isBrm ? '🔴 ' : '🏬 '} {t.name} — {formatRupiah(t.gmv)} ({t.count} order)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Penjelasan Filter yang Aktif */}
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <Filter className="h-3 w-3 text-indigo-500 shrink-0" />
                  <span>
                    {filterMode === 'product'
                      ? `Menyaring khusus produk "${excelResult.filterLabel}". GMV, Komisi, Sesi, Produk Terjual, dan Pesanan di bawah otomatis menyesuaikan produk ini.`
                      : filterMode === 'brm'
                      ? 'Menyaring semua produk Berkah Rosita Mandiri (Pelicin & Pengharum 800ml, 900ml, 1L, 200ml, dll).'
                      : filterMode === 'toko'
                      ? `Hanya menyaring pesanan dari toko "${filterValue}".`
                      : 'Menyimpan seluruh pesanan produk secara campur tanpa filter.'}
                  </span>
                </div>
              </div>

              {/* 5 KPI Cards: GMV, Komisi Bersih, Sesi Live, Produk Terjual, Pesanan Live */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center transition-all hover:shadow-xs">
                  <span className="text-[10px] text-muted-foreground block">Total GMV Live</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {formatRupiah(excelResult.totalGMVLive)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/60 text-center transition-all hover:shadow-xs">
                  <span className="text-[10px] text-muted-foreground block">Komisi Bersih</span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {formatRupiah(excelResult.totalKomisiBersih)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 text-center transition-all hover:shadow-xs">
                  <span className="text-[10px] text-muted-foreground block">Sesi Live</span>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    {excelResult.liveSessions.length} Sesi
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center transition-all hover:shadow-xs">
                  <span className="text-[10px] text-muted-foreground block">Produk Terjual</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {excelResult.totalQty} Pcs
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60 text-center col-span-2 sm:col-span-1 transition-all hover:shadow-xs">
                  <span className="text-[10px] text-muted-foreground block">Pesanan Live</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {excelResult.totalOrders} Order
                  </span>
                </div>
              </div>

              {/* Daftar Sesi Live Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Pratinjau Sesi Siaran ({excelResult.liveSessions.length} sesi siap diimpor):
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[220px]">
                    Target: {excelResult.filterLabel}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-white/70 dark:bg-slate-900/70">
                  {excelResult.liveSessions.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Tidak ada sesi siaran LIVE yang menjual produk ini.
                    </div>
                  ) : (
                    excelResult.liveSessions.map((session, idx) => (
                      <div
                        key={session.contentId || idx}
                        className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono shrink-0">
                            #{idx + 1}
                          </Badge>
                          <div className="truncate">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{session.tanggal}</span>
                            <span className="text-slate-500 ml-1 text-[10px]">{session.waktu}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium shrink-0 truncate max-w-[140px] ${
                            session.nama_toko.includes('Campur')
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {session.nama_toko}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                          <span className="text-slate-500">{session.produk_terjual} Pcs</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(session.gmv_rupiah)}
                          </span>
                          <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                            Komisi: {formatRupiah(session.komisi_bersih)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
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
            disabled={!excelResult || excelResult.liveSessions.length === 0 || isSubmitting || !selectedHostId}
            onClick={handleConfirmImport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyimpan ke Supabase...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Konfirmasi Impor {excelResult ? `${excelResult.liveSessions.length} Sesi (${excelResult.filterLabel})` : ''}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
