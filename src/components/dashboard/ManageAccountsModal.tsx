import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  AtSign, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  X, 
  Loader2 
} from 'lucide-react'
import { 
  addHostAccount, 
  removeHostAccount, 
  setActiveHostAccount,
  syncHostSessionsAccount,
  normalizeTiktokHandle 
} from '@/lib/hostAccountManager'

interface ManageAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  hostId: string
  profileName?: string
  currentAccounts: string[]
  activeAccount: string
  onAccountsUpdated: (accounts: string[], active: string) => void
}

export const ManageAccountsModal: React.FC<ManageAccountsModalProps> = ({
  isOpen,
  onClose,
  hostId,
  profileName,
  currentAccounts,
  activeAccount,
  onAccountsUpdated,
}) => {
  const [newHandle, setNewHandle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = normalizeTiktokHandle(newHandle)
    if (!clean || clean === '@') {
      setErrorMessage('Masukkan username TikTok yang valid (misal: @petualangansajak)')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await addHostAccount(hostId, clean, profileName)
      if (!res.success) {
        throw new Error(res.error || 'Gagal menambahkan akun')
      }

      setNewHandle('')
      // Otomatis sinkronkan sesi live ke akun baru ini di Supabase
      const syncRes = await syncHostSessionsAccount(hostId, clean)
      const countMsg = syncRes.updatedCount > 0 ? ` (${syncRes.updatedCount} sesi disinkronkan)` : ''
      setSuccessMessage(`Akun ${clean} berhasil ditambahkan dan tersimpan ke Supabase${countMsg}!`)
      onAccountsUpdated(res.accounts, clean)
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menambahkan akun TikTok.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectActive = async (acc: string) => {
    setActiveHostAccount(hostId, acc)
    onAccountsUpdated(currentAccounts, acc)
    setSuccessMessage(`Akun aktif diubah ke ${acc}. Menyinkronkan data sesi...`)
    try {
      const syncRes = await syncHostSessionsAccount(hostId, acc)
      if (syncRes.success && syncRes.updatedCount > 0) {
        setSuccessMessage(`Akun aktif diubah ke ${acc} dan ${syncRes.updatedCount} sesi live berhasil disinkronkan di Supabase!`)
      } else {
        setSuccessMessage(`Akun aktif diubah ke ${acc}`)
      }
    } catch {
      setSuccessMessage(`Akun aktif diubah ke ${acc}`)
    }
  }

  const handleDelete = async (acc: string) => {
    if (currentAccounts.length <= 1) {
      setErrorMessage('Minimal harus ada 1 akun TikTok terdaftar.')
      return
    }

    try {
      const updated = await removeHostAccount(hostId, acc, profileName)
      const newActive = activeAccount === acc ? updated[0] : activeAccount
      onAccountsUpdated(updated, newActive)
      setSuccessMessage(`Akun ${acc} berhasil dihapus.`)
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus akun.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-lg bg-pink-100 dark:bg-pink-950 flex items-center justify-center text-pink-600 dark:text-pink-400">
                <AtSign className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Kelola Akun TikTok Host
                </CardTitle>
                <CardDescription className="text-xs">
                  Tambah akun baru & pilih akun aktif untuk sesi live
                </CardDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4 space-y-4">
          {/* Notification Messages */}
          {successMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
              <X className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Tambah Akun Baru */}
          <form onSubmit={handleAdd} className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Tambah Akun TikTok Baru
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <AtSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="misal: petualangansajak"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  disabled={isSubmitting}
                  className="pl-8 text-xs h-9 font-mono"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || !newHandle.trim()}
                className="h-9 px-3.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold gap-1 shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Akun akan otomatis tersimpan ke database Supabase dan tersedia di formulir & ekspor laporan.
            </p>
          </form>

          {/* Daftar Akun Terdaftar */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Daftar Akun Anda ({currentAccounts.length})
              </label>
              <span className="text-[10px] text-muted-foreground">Pilih untuk mengaktifkan</span>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {currentAccounts.map((acc) => {
                const isActive = acc === activeAccount
                return (
                  <div
                    key={acc}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'border-pink-300 bg-pink-50/60 dark:border-pink-800 dark:bg-pink-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleSelectActive(acc)}
                        className={`h-4 w-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                          isActive
                            ? 'border-pink-600 bg-pink-600 text-white'
                            : 'border-slate-400 hover:border-pink-500'
                        }`}
                        title="Pilih sebagai akun aktif"
                      >
                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </button>

                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                        {acc}
                      </span>

                      {isActive && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900 dark:text-pink-300 font-semibold"
                        >
                          Aktif
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectActive(acc)}
                          className="h-7 px-2 text-[11px] text-pink-600 hover:bg-pink-100/60"
                        >
                          Gunakan
                        </Button>
                      )}

                      {currentAccounts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(acc)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Hapus akun dari daftar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>

        {/* Footer */}
        <CardFooter className="pt-2 pb-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8"
          >
            Selesai
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
