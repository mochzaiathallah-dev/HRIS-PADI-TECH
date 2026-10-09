import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { LaporanBimbel, Murid } from '@/types'
import { compressClientImage, CompressionResult, formatFileSize } from '@/lib/imageCompressor'
import { parsePhotoUrls, serializePhotoUrls } from '@/lib/photoUtils'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  GraduationCap, 
  X, 
  Calendar, 
  User, 
  BookOpen, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Camera,
  Image as ImageIcon,
  Trash2
} from 'lucide-react'

const editBimbelSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  murid_id: z.string().min(1, 'Siswa wajib dipilih'),
  mata_pelajaran: z.string().min(2, 'Mata pelajaran minimal 2 karakter'),
  topik: z.string().min(3, 'Topik minimal 3 karakter'),
  ringkasan: z.string().min(5, 'Ringkasan minimal 5 karakter'),
})

type EditBimbelFormValues = z.infer<typeof editBimbelSchema>

interface EditBimbelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  laporan: LaporanBimbel | null
  muridList: Murid[]
}

export const EditBimbelModal: React.FC<EditBimbelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  laporan,
  muridList,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([])
  const [newCompressedImages, setNewCompressedImages] = useState<CompressionResult[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditBimbelFormValues>({
    resolver: zodResolver(editBimbelSchema),
  })

  useEffect(() => {
    if (laporan) {
      reset({
        tanggal: laporan.tanggal,
        murid_id: laporan.murid_id,
        mata_pelajaran: laporan.mata_pelajaran,
        topik: laporan.topik,
        ringkasan: laporan.ringkasan,
      })
      setExistingPhotoUrls(parsePhotoUrls(laporan.foto_kegiatan_url))
      setNewCompressedImages([])
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [laporan, reset])

  // Bersihkan object URL saat modal ditutup
  useEffect(() => {
    return () => {
      newCompressedImages.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
      })
    }
  }, [newCompressedImages])

  const totalPhotosCount = existingPhotoUrls.length + newCompressedImages.length

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remainingSlots = 5 - totalPhotosCount
    if (remainingSlots <= 0) {
      setErrorMessage('Maksimal 5 foto dokumentasi untuk setiap sesi belajar.')
      return
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots)
    setIsCompressing(true)
    setErrorMessage(null)

    try {
      const results: CompressionResult[] = []
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) continue
        const result = await compressClientImage(file, 1280, 0.75)
        results.push(result)
      }

      setNewCompressedImages((prev) => [...prev, ...results])
    } catch (err: any) {
      console.error('Compression error:', err)
      setErrorMessage('Gagal memproses gambar. Pastikan format file JPG, PNG, atau WEBP.')
    } finally {
      setIsCompressing(false)
      e.target.value = ''
    }
  }

  const removeExistingPhoto = (index: number) => {
    setExistingPhotoUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const removeNewPhoto = (index: number) => {
    setNewCompressedImages((prev) => {
      const target = prev[index]
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const onSubmit = async (values: EditBimbelFormValues) => {
    if (!laporan?.id) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const uploadedNewUrls: string[] = []

      // Upload semua foto baru ke Supabase Storage (Bucket bukti_tiktok)
      if (newCompressedImages.length > 0) {
        for (let idx = 0; idx < newCompressedImages.length; idx++) {
          const item = newCompressedImages[idx]
          const fileExt = 'webp'
          const fileName = `bimbel/${laporan.tutor_id || 'general'}/${Date.now()}_${idx + 1}_edit.${fileExt}`
          const { error: uploadError } = await supabase.storage
            .from('bukti_tiktok')
            .upload(fileName, item.file, {
              contentType: 'image/webp',
              upsert: true,
            })

          if (uploadError) throw uploadError

          const { data: pubData } = supabase.storage
            .from('bukti_tiktok')
            .getPublicUrl(fileName)
          uploadedNewUrls.push(pubData.publicUrl)
        }
      }

      // Gabungkan foto yang dipertahankan + foto baru yang berhasil diunggah
      const allFinalPhotos = [...existingPhotoUrls, ...uploadedNewUrls]
      const serializedPhotoUrls = serializePhotoUrls(allFinalPhotos)

      let isUpdated = false

      // 1. Coba via RPC Security Definer terlebih dahulu
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('tutor_update_laporan_bimbel', {
          p_id: laporan.id,
          p_tanggal: values.tanggal,
          p_murid_id: values.murid_id,
          p_mata_pelajaran: values.mata_pelajaran.trim(),
          p_topik: values.topik.trim(),
          p_ringkasan: values.ringkasan.trim(),
          p_foto_kegiatan_url: serializedPhotoUrls,
        })
        if (!rpcErr && rpcRes && rpcRes.success) {
          isUpdated = true
        }
      } catch (e) {
        console.warn('RPC update bimbel fallback to direct update:', e)
      }

      // 2. Jika RPC belum terpasang atau gagal, fallback ke direct update
      if (!isUpdated) {
        const { error } = await supabase
          .from('laporan_bimbel')
          .update({
            tanggal: values.tanggal,
            murid_id: values.murid_id,
            mata_pelajaran: values.mata_pelajaran.trim(),
            topik: values.topik.trim(),
            ringkasan: values.ringkasan.trim(),
            foto_kegiatan_url: serializedPhotoUrls,
          })
          .eq('id', laporan.id)

        if (error) throw error
      }

      setSuccessMessage('Laporan sesi bimbel & dokumentasi berhasil diperbarui!')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (err: any) {
      console.error('Error updating bimbel report:', err)
      setErrorMessage(err.message || 'Gagal memperbarui laporan bimbel.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !laporan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <Card className="w-full max-w-lg shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Edit Laporan Bimbel</CardTitle>
              <CardDescription className="text-xs">
                Perbarui detail sesi bimbingan belajar siswa
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

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {successMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tanggal */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Tanggal Sesi
                </Label>
                <Input
                  type="date"
                  className="text-xs"
                  disabled={isSubmitting}
                  {...register('tanggal')}
                />
                {errors.tanggal && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.tanggal.message}</p>
                )}
              </div>

              {/* Murid */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  Siswa Binaan
                </Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus:outline-hidden dark:bg-slate-900"
                  disabled={isSubmitting}
                  {...register('murid_id')}
                >
                  <option value="">Pilih Siswa...</option>
                  {muridList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.tingkat_kelas})
                    </option>
                  ))}
                </select>
                {errors.murid_id && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.murid_id.message}</p>
                )}
              </div>
            </div>

            {/* Mata Pelajaran */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                Mata Pelajaran
              </Label>
              <Input
                placeholder="Contoh: Matematika"
                className="text-xs"
                disabled={isSubmitting}
                {...register('mata_pelajaran')}
              />
              {errors.mata_pelajaran && (
                <p className="text-[11px] text-red-500 font-medium">{errors.mata_pelajaran.message}</p>
              )}
            </div>

            {/* Topik */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Topik / Materi Pembelajaran
              </Label>
              <Input
                placeholder="Contoh: Operasi Pecahan Desimal"
                className="text-xs"
                disabled={isSubmitting}
                {...register('topik')}
              />
              {errors.topik && (
                <p className="text-[11px] text-red-500 font-medium">{errors.topik.message}</p>
              )}
            </div>

            {/* Ringkasan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Ringkasan & Catatan Belajar
              </Label>
              <Textarea
                rows={4}
                placeholder="Tuliskan catatan kemajuan siswa..."
                className="text-xs"
                disabled={isSubmitting}
                {...register('ringkasan')}
              />
              {errors.ringkasan && (
                <p className="text-[11px] text-red-500 font-medium">{errors.ringkasan.message}</p>
              )}
            </div>

            {/* Foto Dokumentasi Pembelajaran (Multi-Photo Auto-Compressed WebP) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Foto Dokumentasi Belajar
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {totalPhotosCount}/5 Foto • Auto WebP
                </span>
              </Label>

              {/* Grid Daftar Foto Tersimpan & Baru */}
              {totalPhotosCount > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* 1. Foto Existing yang sudah ada di Supabase */}
                    {existingPhotoUrls.map((url, idx) => (
                      <div
                        key={`existing-${idx}`}
                        className="relative rounded-xl border border-slate-200 dark:border-slate-700 p-2 bg-slate-50/70 dark:bg-slate-800/40 flex items-center gap-2.5"
                      >
                        <img
                          src={url}
                          alt={`Existing Foto ${idx + 1}`}
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 shadow-2xs hover:opacity-85"
                          onClick={() => setPreviewImage(url)}
                          title="Klik untuk perbesar"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                              Foto {idx + 1}
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              Cloud DB
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            Tersimpan di Supabase
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingPhoto(idx)}
                          disabled={isSubmitting}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Hapus Foto Ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* 2. Foto Baru yang Dipilih & Dikompresi */}
                    {newCompressedImages.map((img, idx) => (
                      <div
                        key={`new-${idx}`}
                        className="relative rounded-xl border border-blue-200 dark:border-blue-900 p-2 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2.5"
                      >
                        <img
                          src={img.previewUrl}
                          alt={`Foto Baru ${idx + 1}`}
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 shadow-2xs hover:opacity-85"
                          onClick={() => setPreviewImage(img.previewUrl)}
                          title="Klik untuk perbesar"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[11px] text-blue-800 dark:text-blue-300">
                              Baru {idx + 1}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
                              Hemat {img.ratioPercent}%
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {formatFileSize(img.originalSizeKB)} ➔ {formatFileSize(img.compressedSizeKB)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNewPhoto(idx)}
                          disabled={isSubmitting}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Batal Tambah Foto Ini"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Input Button (Maksimal 5 Foto) */}
              {totalPhotosCount < 5 && (
                <label className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    <span>
                      {isCompressing
                        ? 'Mengompresi foto otomatis ke WebP...'
                        : totalPhotosCount > 0
                        ? `Tambah Foto Dokumentasi (${totalPhotosCount}/5)`
                        : 'Pilih Foto Dokumentasi Belajar (Bisa Lebih dari 1 Foto)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Maksimal 5 foto • JPG/PNG/WEBP (otomatis dikompresi WebP & hemat kuota)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    disabled={isCompressing || isSubmitting}
                    className="hidden"
                  />
                </label>
              )}

              {isCompressing && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Mengompresi gambar otomatis ke format WebP ringan...</span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t p-4 bg-slate-50 dark:bg-slate-900/50">
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
              type="submit"
              size="sm"
              disabled={isSubmitting || isCompressing}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan Perubahan...
                </>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-xl w-full bg-slate-900 rounded-2xl overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Dokumentasi Full" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
