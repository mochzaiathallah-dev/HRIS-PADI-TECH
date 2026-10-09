import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya menerima GET atau POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase configuration missing in environment variables' })
  }


  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    const nowIso = new Date().toISOString()

    // 1. CREATE: Insert 1 small pulse row into system_heartbeat
    const { data: inserted, error: insertErr } = await supabase
      .from('system_heartbeat')
      .insert({ status: 'midnight_alive' })
      .select('id, pinged_at')
      .single()

    // 2. READ: Read latest heartbeat
    const { data: latestRecord, error: readErr } = await supabase
      .from('system_heartbeat')
      .select('id, pinged_at, status')
      .order('id', { ascending: false })
      .limit(1)

    // 3. DELETE / CLEANUP: Keep table ultra-lightweight (hapus riwayat > 7 hari)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('system_heartbeat')
      .delete()
      .lt('pinged_at', sevenDaysAgo)

    return res.status(200).json({
      success: true,
      timestamp: nowIso,
      message: 'Midnight CRUD Heartbeat executed successfully. Supabase active & 100% free plan safe.',
      data: {
        inserted: inserted || null,
        latest: latestRecord || null,
        error: insertErr?.message || readErr?.message || null
      }
    })
  } catch (error: any) {
    console.error('Heartbeat execution error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal error executing heartbeat'
    })
  }
}
