import { supabase } from './supabase'

const LAST_HEARTBEAT_KEY = 'hris_padi_last_heartbeat_timestamp'

/**
 * Memastikan database Supabase selalu aktif (anti-pause) setiap hari jam 12 malam (00:00 WIB),
 * dengan logic efisien tanpa melebihi free tier Vercel & Supabase.
 */
export async function triggerClientHeartbeatIfNeeded(): Promise<void> {
  try {
    const lastHeartbeat = localStorage.getItem(LAST_HEARTBEAT_KEY)
    const now = Date.now()

    // Jalankan maksimal 1 kali setiap 12 jam per perangkat browser
    if (lastHeartbeat) {
      const elapsedHours = (now - parseInt(lastHeartbeat, 10)) / (1000 * 60 * 60)
      if (elapsedHours < 12) {
        return
      }
    }

    // Ping ringan ke Supabase system_heartbeat (CRUD pulse)
    const { error } = await supabase
      .from('system_heartbeat')
      .insert({ status: 'client_active' })

    if (!error) {
      localStorage.setItem(LAST_HEARTBEAT_KEY, now.toString())
    }
  } catch (err) {
    // Fail silently agar tidak mengganggu operasional pengguna
    console.debug('Heartbeat check notice:', err)
  }
}

/**
 * Setup timer tepat jam 00:00 WIB (17:00 UTC) jika browser dibuka semalaman
 */
export function setupMidnightHeartbeatWatcher(): () => void {
  // Jalankan pengecekan pertama kali
  triggerClientHeartbeatIfNeeded()

  // Cek setiap 30 menit apakah sudah lewat midnight
  const interval = setInterval(() => {
    const now = new Date()
    // Jam 00:00 - 00:30 WIB
    const hours = now.getHours()
    if (hours === 0) {
      triggerClientHeartbeatIfNeeded()
    }
  }, 30 * 60 * 1000)

  return () => clearInterval(interval)
}
