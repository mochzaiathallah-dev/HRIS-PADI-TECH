/**
 * Sanitasi teks respon AI agar bebas dari simbol markdown yang mengganggu
 * (seperti **, *, ###, ##, #, ---, >, formula $).
 * Menghasilkan teks bersih yang nyaman dibaca langsung oleh tutor/host/owner.
 */
export function sanitizeAiText(raw?: string | null): string {
  if (!raw) return ''
  return raw
    // Hapus tanda cetak tebal ganda **teks** atau __teks__
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Ubah peluru asterik baris baru (* teks) menjadi bullet rapi (• teks)
    .replace(/^\s*[\*]\s+/gm, '• ')
    // Hapus tanda miring tunggal *teks* atau _teks_
    .replace(/(^|[^\*])\*(?!\s)(.*?)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_])_(?!\s)(.*?)_{1}(?!_)/g, '$1$2')
    // Hapus simbol heading markdown ### atau ## atau #
    .replace(/^#{1,6}\s+/gm, '')
    // Hapus garis pemisah horizontal --- atau *** atau ___
    .replace(/^[\-\*_]{3,}\s*$/gm, '')
    // Hapus tanda quote block >
    .replace(/^>\s+/gm, '')
    // Hapus tanda dolar math rumus LaTeX ($x$)
    .replace(/\$(.*?)\$/g, '$1')
    // Rapikan baris kosong berlebih
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
