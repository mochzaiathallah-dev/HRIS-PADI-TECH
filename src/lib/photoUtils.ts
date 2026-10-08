/**
 * Helper untuk mengelola satu atau banyak URL foto dokumentasi kegiatan bimbel.
 * Mendukung format string tunggal, JSON array string '["url1", "url2"]', maupun baris baru.
 */

export function parsePhotoUrls(raw?: string | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []

  // Format JSON array misal: ["url1", "url2"]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      }
    } catch {}
  }

  // Format newline-separated
  if (trimmed.includes('\n')) {
    return trimmed.split(/\r?\n/).map((u) => u.trim()).filter(Boolean)
  }

  // Format comma-separated (kecuali base64 data url)
  if (trimmed.includes(',') && !trimmed.startsWith('data:')) {
    return trimmed.split(',').map((u) => u.trim()).filter(Boolean)
  }

  return [trimmed]
}

export function serializePhotoUrls(urls: string[]): string | null {
  const filtered = (urls || []).filter(Boolean)
  if (filtered.length === 0) return null
  if (filtered.length === 1) return filtered[0]
  return JSON.stringify(filtered)
}

/**
 * Format link dokumentasi untuk pesan WhatsApp rapi ke orang tua murid
 */
export function formatWhatsAppPhotoLinks(urls: string[]): string {
  const list = (urls || []).filter(Boolean)
  if (list.length === 0) return ''

  if (list.length === 1) {
    return `\n📷 *Dokumentasi Pembelajaran:*\n${list[0]}`
  }

  const items = list.map((url, i) => `Foto ${i + 1}: ${url}`).join('\n')
  return `\n📷 *Dokumentasi Pembelajaran:*\n${items}`
}
