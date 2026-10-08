import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  title: string
  description: string
  itemName?: string
  isDeleting?: boolean
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  isDeleting = false,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-red-100 dark:border-red-950 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-3 pb-3 border-b">
          <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-red-600 dark:text-red-400">
              {title}
            </CardTitle>
            <CardDescription className="text-xs">
              Konfirmasi penghapusan data secara permanen
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
          {itemName && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 font-semibold text-xs text-red-700 dark:text-red-300 truncate">
              {itemName}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t p-4 bg-slate-50 dark:bg-slate-900/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs shadow-md shadow-red-500/20"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menghapus...
              </>
            ) : (
              'Ya, Hapus Sekarang'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
