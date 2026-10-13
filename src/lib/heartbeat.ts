import { supabase } from './supabase'

const LAST_HEARTBEAT_KEY = 'hris_padi_last_heartbeat_timestamp'
const LAST_MIDNIGHT_CHECK_KEY = 'hris_padi_last_midnight_date'

/**
 * Memastikan database Supabase selalu aktif (anti-pause) setiap hari jam 12 malam (00:00 WIB),
 * dengan query baca (READ) super ringan tanpa melebihi free tier Vercel & Supabase.
 */
export async function triggerClientHeartbeatIfNeeded(): Promise<void> {
  try {
    const lastHeartbeat = localStorage.getItem(LAST_HEARTBEAT_KEY)
    const now = Date.now()

    // Batasi pengecekan umum agar tidak berulang dalam 6 jam
    if (lastHeartbeat) {
      const elapsedHours = (now - parseInt(lastHeartbeat, 10)) / (1000 * 60 * 60)
      if (elapsedHours < 6) {
        return
      }
    }

    // Ping READ ringan ke Supabase: membaca 1 row id (aktivitas valid untuk reset inactivity timer 7 hari)
    let { error } = await supabase.from('laporan_tiktok').select('id').limit(1)
    if (error) {
      const fallback = await supabase.from('system_heartbeat').select('id').limit(1)
      error = fallback.error
    }

    localStorage.setItem(LAST_HEARTBEAT_KEY, now.toString())
  } catch (err) {
    // Fail silently agar tidak mengganggu operasional pengguna
    console.debug('Heartbeat check notice:', err)
  }
}

/**
 * Setup timer tepat jam 00:00 WIB (12 malam) jika dashboard dibuka semalaman.
 * Membaca database secara berkala setiap jam 12 malam agar Supabase tidak terhenti (pause),
 * serta memperbarui tampilan dashboard secara realtime tanpa membebani kuota free plan.
 */
export function setupMidnightHeartbeatWatcher(onMidnightRefresh?: () => void): () => void {
  // Jalankan pengecekan ringan saat dashboard pertama dibuka
  triggerClientHeartbeatIfNeeded()

  // Cek setiap 1 menit apakah tepat memasuki jam 00:00 WIB (12 malam)
  const interval = setInterval(async () => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const todayDateStr = now.toISOString().split('T')[0]
    const lastMidnightDate = localStorage.getItem(LAST_MIDNIGHT_CHECK_KEY)

    // Deteksi jika saat ini jam 00:00 - 00:05 WIB dan belum membaca untuk tanggal hari ini
    if (hours === 0 && minutes <= 5 && lastMidnightDate !== todayDateStr) {
      try {
        localStorage.setItem(LAST_MIDNIGHT_CHECK_KEY, todayDateStr)
        // Lakukan pembacaan database keep-alive
        await triggerClientHeartbeatIfNeeded()
        // Refresh data dashboard secara realtime
        if (onMidnightRefresh) {
          onMidnightRefresh()
        }
      } catch (e) {
        console.debug('Midnight keep-alive notice:', e)
      }
    }
  }, 60 * 1000)

  return () => clearInterval(interval)
}
