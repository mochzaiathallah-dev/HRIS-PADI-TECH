import { supabase } from './supabase'

const ACCOUNTS_STORAGE_PREFIX = 'hris_host_accounts_'
const ACTIVE_ACCOUNT_PREFIX = 'hris_active_account_'

/**
 * Normalisasi format username TikTok (selalu diawali @, huruf kecil, tanpa spasi)
 */
export function normalizeTiktokHandle(handle: string): string {
  if (!handle) return ''
  let clean = handle.trim().toLowerCase()
  if (!clean.startsWith('@')) {
    clean = `@${clean}`
  }
  return clean.replace(/\s+/g, '')
}

/**
 * Dapatkan username default berdasarkan nama profil host
 * Misal "petualangansajak" -> "@petualangansajak", "Nurin Savira" -> "@wangigaya"
 */
export function getDefaultHandleForProfile(nama?: string): string {
  if (!nama) return '@petualangansajak'
  const lower = nama.trim().toLowerCase()
  if (lower.includes('nurin')) return '@wangigaya'
  if (lower.includes('petualangan')) return '@petualangansajak'
  return normalizeTiktokHandle(lower) || '@petualangansajak'
}

/**
 * Ambil daftar akun TikTok milik Host tertentu (Supabase + LocalStorage + Laporan)
 */
export async function fetchHostAccounts(hostId: string, profileName?: string): Promise<string[]> {
  const defaultHandle = getDefaultHandleForProfile(profileName)
  const accountSet = new Set<string>()

  // 1. Akun default dari nama profil
  accountSet.add(defaultHandle)

  // 2. Baca dari Supabase table akun_tiktok_host jika ada
  try {
    const { data, error } = await supabase
      .from('akun_tiktok_host')
      .select('username')
      .eq('host_id', hostId)
      .order('created_at', { ascending: true })

    if (!error && data && data.length > 0) {
      data.forEach((row: any) => {
        if (row.username) accountSet.add(normalizeTiktokHandle(row.username))
      })
    }
  } catch (e) {
    // Fail-safe jika tabel belum dimigrasi di postgres
    console.debug('akun_tiktok_host query notice:', e)
  }

  // 3. Baca distinct akun dari laporan_tiktok milik host ini
  try {
    const { data: repData } = await supabase
      .from('laporan_tiktok')
      .select('akun_tiktok')
      .eq('host_id', hostId)
      .not('akun_tiktok', 'is', null)

    if (repData) {
      repData.forEach((r: any) => {
        if (r.akun_tiktok) accountSet.add(normalizeTiktokHandle(r.akun_tiktok))
      })
    }
  } catch {}

  // 4. Baca dari LocalStorage sebagai offline / fast cache
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${ACCOUNTS_STORAGE_PREFIX}${hostId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          parsed.forEach((h: string) => accountSet.add(normalizeTiktokHandle(h)))
        }
      }
    } catch {}
  }

  const result = Array.from(accountSet)

  // Simpan kembali ke localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${ACCOUNTS_STORAGE_PREFIX}${hostId}`, JSON.stringify(result))
    } catch {}
  }

  return result
}

/**
 * Tambah akun TikTok baru untuk host (Tersimpan realtime di Supabase & LocalStorage)
 */
export async function addHostAccount(
  hostId: string,
  username: string,
  profileName?: string
): Promise<{ success: boolean; accounts: string[]; error?: string }> {
  const clean = normalizeTiktokHandle(username)
  if (!clean || clean === '@') {
    return { success: false, accounts: await fetchHostAccounts(hostId, profileName), error: 'Username TikTok tidak boleh kosong' }
  }

  // 1. Simpan ke Supabase table akun_tiktok_host (jika tabel ada)
  try {
    await supabase.from('akun_tiktok_host').insert({
      host_id: hostId,
      username: clean,
    })
  } catch (err: any) {
    console.debug('Insert akun_tiktok_host notice:', err?.message)
  }

  // 2. Simpan ke LocalStorage
  const accounts = await fetchHostAccounts(hostId, profileName)
  if (!accounts.includes(clean)) {
    accounts.push(clean)
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${ACCOUNTS_STORAGE_PREFIX}${hostId}`, JSON.stringify(accounts))
      localStorage.setItem(`${ACTIVE_ACCOUNT_PREFIX}${hostId}`, clean)
    } catch {}
  }

  // 3. Broadcast update akun ke seluruh tab & dashboard via Supabase Realtime Channel
  try {
    const channel = supabase.channel('realtime_host_accounts')
    channel.send({
      type: 'broadcast',
      event: 'account_added',
      payload: { hostId, username: clean, allAccounts: accounts },
    })
  } catch {}

  return { success: true, accounts }
}

/**
 * Hapus akun TikTok dari daftar host
 */
export async function removeHostAccount(
  hostId: string,
  username: string,
  profileName?: string
): Promise<string[]> {
  const clean = normalizeTiktokHandle(username)

  // 1. Hapus dari Supabase jika ada
  try {
    await supabase
      .from('akun_tiktok_host')
      .delete()
      .eq('host_id', hostId)
      .eq('username', clean)
  } catch {}

  // 2. Hapus dari LocalStorage
  let accounts = await fetchHostAccounts(hostId, profileName)
  accounts = accounts.filter((a) => a !== clean)

  // Jangan kosongkan total, pertahankan default jika kosong
  if (accounts.length === 0) {
    accounts = [getDefaultHandleForProfile(profileName)]
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${ACCOUNTS_STORAGE_PREFIX}${hostId}`, JSON.stringify(accounts))
      const active = getActiveHostAccount(hostId, profileName)
      if (active === clean) {
        localStorage.setItem(`${ACTIVE_ACCOUNT_PREFIX}${hostId}`, accounts[0])
      }
    } catch {}
  }

  // Broadcast
  try {
    const channel = supabase.channel('realtime_host_accounts')
    channel.send({
      type: 'broadcast',
      event: 'account_removed',
      payload: { hostId, username: clean, allAccounts: accounts },
    })
  } catch {}

  return accounts
}

/**
 * Dapatkan Akun Aktif saat ini untuk host
 */
export function getActiveHostAccount(hostId: string, profileName?: string): string {
  const defaultHandle = getDefaultHandleForProfile(profileName)
  if (typeof window === 'undefined') return defaultHandle

  try {
    const active = localStorage.getItem(`${ACTIVE_ACCOUNT_PREFIX}${hostId}`)
    if (active) return normalizeTiktokHandle(active)
  } catch {}

  return defaultHandle
}

/**
 * Set Akun Aktif saat ini untuk host
 */
export function setActiveHostAccount(hostId: string, username: string): void {
  const clean = normalizeTiktokHandle(username)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${ACTIVE_ACCOUNT_PREFIX}${hostId}`, clean)
      // Broadcast
      const channel = supabase.channel('realtime_host_accounts')
      channel.send({
        type: 'broadcast',
        event: 'active_account_changed',
        payload: { hostId, activeAccount: clean },
      })
    } catch {}
  }
}

/**
 * Sinkronkan seluruh data sesi live milik host di Supabase ke akun TikTok tertentu
 * (Memperbarui seluruh sesi lama dari @wangigaya ke @petualangansajak secara realtime)
 */
export async function syncHostSessionsAccount(
  hostId: string,
  targetAccount: string,
  sessionIds?: string[]
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const clean = normalizeTiktokHandle(targetAccount)
  if (!clean) {
    return { success: false, updatedCount: 0, error: 'Target akun tidak valid' }
  }

  try {
    let query = supabase.from('laporan_tiktok').update({ akun_tiktok: clean })

    if (sessionIds && sessionIds.length > 0) {
      query = query.in('id', sessionIds)
    } else if (hostId) {
      query = query.eq('host_id', hostId)
    }

    const { data, error } = await query.select('id')

    if (error) {
      console.warn('Sync host sessions notice:', error.message)
      throw error
    }

    // Broadcast event
    try {
      const channel = supabase.channel('realtime_host_accounts')
      channel.send({
        type: 'broadcast',
        event: 'sessions_account_synced',
        payload: { hostId, syncedAccount: clean, count: data?.length || 0 },
      })
    } catch {}

    return { success: true, updatedCount: data?.length || 0 }
  } catch (err: any) {
    console.error('Error syncing host sessions account:', err)
    return { success: false, updatedCount: 0, error: err.message || 'Gagal sinkronisasi sesi' }
  }
}
