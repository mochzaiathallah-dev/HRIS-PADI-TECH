import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { exportAiContentToPdf } from '@/lib/aiPdfExporter'
import { sanitizeAiText } from '@/lib/aiTextSanitizer'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  X, 
  Send, 
  Copy, 
  Check, 
  Loader2, 
  Trash2, 
  GraduationCap, 
  Video, 
  ShieldCheck,
  FileDown,
  Plus,
  MessageSquare,
  Search,
  Menu,
  Download,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react'

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

interface ChatMessage {
  id: string
  session_id: string
  session_title?: string
  sender: 'user' | 'ai'
  text: string
  image_url?: string
  timestamp: string
  createdAt: string
}

interface ChatSession {
  id: string
  title: string
  lastMessageAt: string
}

const ROLE_PRESETS = {
  tutor: {
    title: 'AI Asisten Tutor Bimbel',
    badge: 'Tutor Assistant',
    badgeColor: 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    icon: GraduationCap,
    gradient: 'from-blue-600 to-indigo-600',
    greeting: 'Halo! Saya adalah Asisten AI Tutor Bimbel HRIS PADI TECH. Ada materi, soal latihan, ide evaluasi siswa, atau gambar ilustrasi yang ingin saya buatkan hari ini?',
    suggestions: [
      '🎨 Buatkan gambar anatomi organ tubuh depan manusia untuk materi IPA SD/SMP.',
      'Buatkan 5 soal latihan Matematika pecahan kelas 5 SD beserta kunci jawaban dan cara penyelesaian.',
      '🎨 Buatkan gambar ilustrasi tata surya dan orbit planet untuk materi sains.',
      'Bagaimana cara menjelaskan konsep organel sel biologi agar mudah diingat anak SMP?',
      'Buatkan draf kalimat evaluasi perkembangan belajar positif untuk siswa yang aktif tapi kurang teliti.',
      'Berikan ide ice-breaking edukatif 5 menit di awal sesi les bimbingan belajar.'
    ]
  },
  host: {
    title: 'AI Asisten Host TikTok Live',
    badge: 'Live Commerce AI',
    badgeColor: 'border-pink-200 bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    icon: Video,
    gradient: 'from-pink-600 to-purple-600',
    greeting: 'Halo! Saya adalah Asisten AI Host Live Commerce HRIS PADI TECH. Siap membantu membuat script live viral, ide banner promosi, dan strategi GMV hari ini?',
    suggestions: [
      '🎨 Buatkan gambar banner promosi diskon spesial TikTok Live Commerce keranjang kuning.',
      'Buatkan 3 kalimat hook pembuka live streaming TikTok dalam 3 detik pertama agar penonton tidak scroll.',
      'Buatkan script ajakan checkout (Call To Action) keranjang kuning yang persuasif dan ada urgensi waktu.',
      'Tips menjaga energi dan retensi penonton live saat views sedang turun di menit ke-30.',
      'Ide permainan tebak-tebakan atau QnA interaktif saat live streaming produk.'
    ]
  },
  owner: {
    title: 'AI Penasihat Bisnis Owner',
    badge: 'Executive Advisor',
    badgeColor: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    icon: ShieldCheck,
    gradient: 'from-indigo-600 to-slate-900',
    greeting: 'Selamat datang, Owner. Saya siap mendampingi analisis pertumbuhan bisnis bimbel, live commerce, dan pembuatan materi visual HRIS PADI TECH.',
    suggestions: [
      '🎨 Buatkan gambar infografis strategi bisnis pertumbuhan bimbel dan live commerce.',
      'Bagaimana strategi meningkatkan omset bimbel dan live commerce secara bersamaan di bulan ini?',
      'Buatkan draf pengumuman resmi ke seluruh karyawan terkait kedisiplinan pengisian laporan harian.',
      'Berikan indikator KPI yang adil dan memotivasi untuk Tutor Bimbel dan Host TikTok Live.',
      'Analisis cara meningkatkan margin profit operasional tanpa mengurangi kualitas pembelajaran.'
    ]
  }
}

export const AiAssistantModal: React.FC = () => {
  const { user, profile, role } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchSessionQuery, setSearchSessionQuery] = useState('')
  const [isImageMode, setIsImageMode] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  // State Sessions & Messages
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateUUID())
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([])
  const isInitialLoadRef = useRef(true)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const currentRole = role === 'host' ? 'host' : role === 'owner' ? 'owner' : 'tutor'
  const config = ROLE_PRESETS[currentRole]

  // Reset initial load state when user or role changes
  useEffect(() => {
    isInitialLoadRef.current = true
    setCurrentSessionId(generateUUID())
  }, [user?.id, currentRole])

  // Reset initial load flag when modal is closed
  useEffect(() => {
    if (!isOpen) {
      isInitialLoadRef.current = true
    }
  }, [isOpen])

  // 1. Fetch Chat History dari Supabase
  const fetchChatHistory = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', currentRole)
        .order('created_at', { ascending: true })

      if (!error && data) {
        const mapped: ChatMessage[] = data.map((d: any) => {
          let rawContent = d.content || ''
          let imageUrl: string | undefined = d.image_url || undefined

          // 1. Ekstraksi tag URL gambar SEBELUM sanitizeAiText (mencegah underscore terhapus)
          const imgMatch = rawContent.match(/\[(?:AI_?IMAGE_?URL|IMAGE_?URL|AIIMAGEURL):\s*(https?:\/\/[^\s\]]+)\]/i)
          if (imgMatch) {
            if (!imageUrl) imageUrl = imgMatch[1]
            rawContent = rawContent.replace(imgMatch[0], '').trim()
          }

          let text = sanitizeAiText(rawContent)

          // 2. Cek cadangan jika masih ada format sisa yang tersanitasi
          const fallbackMatch = text.match(/\[(?:AI_?IMAGE_?URL|IMAGE_?URL|AIIMAGEURL):\s*(https?:\/\/[^\s\]]+)\]/i)
          if (fallbackMatch) {
            if (!imageUrl) imageUrl = fallbackMatch[1]
            text = text.replace(fallbackMatch[0], '').trim()
          }

          return {
            id: d.id,
            session_id: d.session_id || 'default-session',
            session_title: d.session_title || undefined,
            sender: d.message_role === 'user' ? 'user' : 'ai',
            text,
            image_url: imageUrl,
            timestamp: new Date(d.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            createdAt: d.created_at,
          }
        })
        setAllMessages(mapped)

        // Hanya saat pertama kali modal dibuka: pilih sesi tersimpan yang paling baru
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false
          if (mapped.length > 0) {
            const sessions = Array.from(new Set(mapped.map((m) => m.session_id)))
            if (sessions.length > 0) {
              setCurrentSessionId(sessions[sessions.length - 1])
            }
          }
        }
      }
    } catch (err) {
      console.debug('Notice fetching ai_chat_history:', err)
    }
  }, [user?.id, currentRole])

  useEffect(() => {
    if (isOpen) {
      fetchChatHistory()
    }
  }, [isOpen, fetchChatHistory])

  // 2. Realtime Listener untuk ai_chat_history
  useEffect(() => {
    if (!user?.id || !isOpen) return

    const channel = supabase
      .channel(`realtime_ai_chat_${user.id}_${currentRole}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_chat_history',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchChatHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, isOpen, currentRole, fetchChatHistory])

  // Auto-scroll ke pesan terakhir
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages, isLoading, currentSessionId])

  // Grouping Sessions untuk Sidebar Gemini Style
  const sessionsList: ChatSession[] = useMemo(() => {
    const map = new Map<string, { title: string; lastMessageAt: string }>()

    allMessages.forEach((msg) => {
      const existing = map.get(msg.session_id)
      let title = existing?.title
      if (!title && msg.session_title) {
        title = msg.session_title
      }
      if (!title && msg.sender === 'user') {
        title = msg.text.slice(0, 32) + (msg.text.length > 32 ? '...' : '')
      }
      map.set(msg.session_id, {
        title: title || existing?.title || 'Percakapan Baru',
        lastMessageAt: msg.createdAt,
      })
    })

    // Pastikan currentSessionId terdaftar bila belum ada pesan
    if (!map.has(currentSessionId)) {
      map.set(currentSessionId, {
        title: 'Percakapan Baru',
        lastMessageAt: new Date().toISOString(),
      })
    }

    const list: ChatSession[] = Array.from(map.entries()).map(([id, info]) => ({
      id,
      title: info.title,
      lastMessageAt: info.lastMessageAt,
    }))

    // Urutkan dari percakapan terbaru
    list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    return list
  }, [allMessages, currentSessionId])

  const filteredSessions = useMemo(() => {
    if (!searchSessionQuery.trim()) return sessionsList
    return sessionsList.filter((s) =>
      s.title.toLowerCase().includes(searchSessionQuery.toLowerCase())
    )
  }, [sessionsList, searchSessionQuery])

  // Pesan untuk sesi yang sedang dibuka
  const currentSessionMessages = useMemo(() => {
    return allMessages.filter((m) => m.session_id === currentSessionId)
  }, [allMessages, currentSessionId])

  // Mulai Percakapan Baru (Gemini "+ Percakapan Baru")
  const handleStartNewChat = () => {
    const newId = generateUUID()
    setCurrentSessionId(newId)
    setPrompt('')
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
    setTimeout(() => inputRef.current?.focus(), 150)
  }

  // Hapus Satu Pesan (CRUD Pesan)
  const handleDeleteMessage = async (msgId: string) => {
    setAllMessages((prev) => prev.filter((m) => m.id !== msgId))
    if (user?.id) {
      try {
        await supabase.from('ai_chat_history').delete().eq('id', msgId)
      } catch (err) {
        console.warn('Gagal menghapus pesan dari Supabase:', err)
      }
    }
  }

  // Hapus Seluruh Sesi Chat Ini (CRUD Sesi)
  const handleDeleteSession = async (sessionIdToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const confirmDelete = window.confirm('Hapus percakapan ini secara permanen?')
    if (!confirmDelete) return

    setAllMessages((prev) => prev.filter((m) => m.session_id !== sessionIdToDelete))

    if (sessionIdToDelete === currentSessionId) {
      handleStartNewChat()
    }

    if (user?.id) {
      try {
        if (sessionIdToDelete === 'default-session') {
          await supabase
            .from('ai_chat_history')
            .delete()
            .eq('user_id', user.id)
            .eq('role', currentRole)
            .is('session_id', null)
        } else {
          await supabase
            .from('ai_chat_history')
            .delete()
            .eq('user_id', user.id)
            .eq('role', currentRole)
            .eq('session_id', sessionIdToDelete)
        }
      } catch (err) {
        console.warn('Gagal menghapus sesi dari Supabase:', err)
      }
    }
  }

  // Download Gambar AI HD
  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}_ai.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  // Kirim Pesan ke AI
  const handleSendMessage = async (textToSend?: string, forceMakeImage?: boolean) => {
    const text = (textToSend || prompt).trim()
    if (!text || isLoading) return

    const makeImage = Boolean(forceMakeImage ?? isImageMode)
    const userMsgId = generateUUID()
    const userTimestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const nowIso = new Date().toISOString()
    const activeSessionId = currentSessionId
    const sessionTitle = text.slice(0, 35)

    const userMsg: ChatMessage = {
      id: userMsgId,
      session_id: activeSessionId,
      session_title: sessionTitle,
      sender: 'user',
      text,
      timestamp: userTimestamp,
      createdAt: nowIso,
    }

    // Optimistic UI update
    setAllMessages((prev) => [...prev, userMsg])
    setPrompt('')
    setIsLoading(true)

    // Simpan pesan user ke Supabase
    if (user?.id) {
      try {
        const payload: any = {
          id: userMsgId,
          user_id: user.id,
          role: currentRole,
          message_role: 'user',
          content: text,
          session_id: activeSessionId,
          session_title: sessionTitle,
        }
        const { error: insErr } = await supabase.from('ai_chat_history').insert(payload)
        // Fallback jika kolom session_id belum dibuat di database
        if (insErr) {
          console.warn('Notice inserting user message:', insErr)
          if (insErr.message?.includes('session_id')) {
            delete payload.session_id
            delete payload.session_title
            await supabase.from('ai_chat_history').insert(payload)
          }
        }
      } catch (err) {
        console.debug('Insert user message notice:', err)
      }
    }

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          role: currentRole,
          makeImage,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghubungi server Gemini AI.')
      }

      const cleanAnswer = sanitizeAiText(data.answer || 'Respon tidak ditemukan.')
      const returnedImageUrl: string | undefined = data.imageUrl || undefined
      const aiMsgId = generateUUID()

      const aiMsg: ChatMessage = {
        id: aiMsgId,
        session_id: activeSessionId,
        session_title: sessionTitle,
        sender: 'ai',
        text: cleanAnswer,
        image_url: returnedImageUrl,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      }

      setAllMessages((prev) => [...prev, aiMsg])

      // Simpan respon AI ke Supabase (tersimpan baik dengan kolom image_url maupun embed content)
      if (user?.id) {
        try {
          const contentToSave = returnedImageUrl
            ? `${cleanAnswer}\n\n[AI_IMAGE_URL: ${returnedImageUrl}]`
            : cleanAnswer

          const payload: any = {
            id: aiMsgId,
            user_id: user.id,
            role: currentRole,
            message_role: 'assistant',
            content: contentToSave,
            session_id: activeSessionId,
            session_title: sessionTitle,
            image_url: returnedImageUrl || null,
          }
          const { error: insErr } = await supabase.from('ai_chat_history').insert(payload)
          if (insErr) {
            console.warn('Notice inserting AI message:', insErr)
            if (insErr.message?.includes('image_url') || insErr.message?.includes('column')) {
              delete payload.image_url
            }
            if (insErr.message?.includes('session_id')) {
              delete payload.session_id
              delete payload.session_title
            }
            await supabase.from('ai_chat_history').insert(payload)
          }
        } catch (err) {
          console.debug('Insert AI message notice:', err)
        }
      }
    } catch (err: any) {
      const errorMsgId = generateUUID()
      const errorMsg: ChatMessage = {
        id: errorMsgId,
        session_id: activeSessionId,
        session_title: sessionTitle,
        sender: 'ai',
        text: `Maaf, terjadi kendala saat memproses jawaban: ${err.message || 'Koneksi ke server AI terputus.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      }
      setAllMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      setIsImageMode(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      {/* Floating Trigger Button di Pojok Kanan Bawah */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
        title="Buka AI Asisten Cerdas HRIS PADI TECH"
      >
        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 animate-pulse" />
        <span className="text-[11px] sm:text-xs font-bold tracking-wide">Tanya AI Asisten</span>
      </button>

      {/* Main Full-Screen Dialog (Gemini Style Interface) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-6xl h-[95vh] sm:h-[92vh] max-h-[850px] bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row text-slate-100 font-sans">
            
            {/* ============================================================== */}
            {/* 1. LEFT SIDEBAR (GEMINI CONVERSATIONS LIST)                    */}
            {/* ============================================================== */}
            <div
              className={`${
                sidebarOpen ? 'flex' : 'hidden'
              } md:flex flex-col w-full md:w-72 bg-slate-950/80 border-r border-slate-800/80 shrink-0 z-20 h-full`}
            >
              {/* Header Sidebar: Logo & New Chat */}
              <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                      Gemini HRIS
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">HRIS PADI TECH</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Action Button: + Percakapan Baru */}
              <div className="p-3">
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer group"
                >
                  <Plus className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span>Percakapan baru</span>
                </button>
              </div>

              {/* Search Sesi Percakapan */}
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchSessionQuery}
                    onChange={(e) => setSearchSessionQuery(e.target.value)}
                    placeholder="Telusuri percakapan..."
                    className="w-full h-8 pl-8 pr-3 text-[11px] bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* List Sesi Percakapan ("Terbaru") */}
              <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Terbaru
                </div>

                {filteredSessions.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-slate-500">
                    Belum ada riwayat percakapan.
                  </div>
                ) : (
                  filteredSessions.map((session) => {
                    const isActive = session.id === currentSessionId
                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          setCurrentSessionId(session.id)
                          if (window.innerWidth < 768) setSidebarOpen(false)
                        }}
                        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                          isActive
                            ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30 font-medium'
                            : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-1">
                          <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                          <span className="truncate">{session.title}</span>
                        </div>

                        {/* Tombol Hapus Sesi (CRUD) */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          title="Hapus percakapan ini"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bottom Profile Footer */}
              <div className="p-3 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300">
                    {(profile?.nama || user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {profile?.nama || user?.email?.split('@')[0]}
                    </p>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-400/30 text-blue-400">
                      {currentRole.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* 2. RIGHT MAIN CHAT AREA (GEMINI STREAM & INPUT)                 */}
            {/* ============================================================== */}
            <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden relative">
              
              {/* Top Navigation Bar */}
              <div className="p-3.5 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Buka/Tutup Sidebar"
                  >
                    <Menu className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-slate-200">
                      {config.title}
                    </span>
                    <Badge variant="outline" className={`text-[10px] hidden sm:inline-flex ${config.badgeColor}`}>
                      Gemini 3.5 Multimodal AI
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(currentSessionId)}
                    title="Bersihkan obrolan ini"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 text-xs transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Tutup Modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {currentSessionMessages.length === 0 ? (
                  // Empty State / Greeting & Quick Suggestions
                  <div className="max-w-2xl mx-auto py-8 sm:py-12 space-y-6 text-center animate-in fade-in">
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                        Halo, {profile?.nama || 'Rekan Tutor'}!
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                        {config.greeting}
                      </p>
                    </div>

                    {/* Quick Suggestion Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4 text-left">
                      {config.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-blue-500/40 text-xs text-slate-300 hover:text-white transition-all duration-150 flex flex-col justify-between group shadow-2xs"
                        >
                          <span className="leading-relaxed">{sug}</span>
                          <span className="text-[10px] text-blue-400 font-semibold mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Tanyakan ini ➔
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Message Stream
                  <div className="max-w-3xl mx-auto space-y-5">
                    {currentSessionMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 animate-in fade-in ${
                          msg.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Bot Avatar */}
                        {msg.sender === 'ai' && (
                          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}

                        {(() => {
                          let displayImageUrl = msg.image_url
                          let displayText = msg.text

                          const inlineImgMatch = displayText.match(/\[(?:AI_?IMAGE_?URL|IMAGE_?URL|AIIMAGEURL):\s*(https?:\/\/[^\s\]]+)\]/i)
                          if (inlineImgMatch) {
                            if (!displayImageUrl) displayImageUrl = inlineImgMatch[1]
                            displayText = displayText.replace(inlineImgMatch[0], '').trim()
                          }

                          return (
                            <div
                              className={`group relative max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                                msg.sender === 'user'
                                  ? 'bg-blue-600 text-white rounded-br-xs shadow-md shadow-blue-600/20'
                                  : 'bg-slate-800/90 text-slate-200 border border-slate-750 rounded-bl-xs shadow-sm'
                              }`}
                            >
                              {/* Text Content */}
                              <div className="whitespace-pre-wrap select-text leading-relaxed font-normal">
                                {displayText}
                              </div>

                              {/* Tampilan Gambar AI Resolusi Tinggi jika tersedia */}
                              {displayImageUrl && (
                                <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/80 shadow-md">
                                  <div className="relative group/img overflow-hidden flex items-center justify-center bg-slate-950 min-h-[180px] max-h-[380px]">
                                    <img
                                      src={displayImageUrl}
                                      alt="Gambar Ilustrasi AI HRIS PADI TECH"
                                      className="w-full h-auto max-h-[380px] object-contain rounded-t-xl transition-transform duration-300 group-hover/img:scale-[1.02] cursor-pointer"
                                      onClick={() => setPreviewImageUrl(displayImageUrl || null)}
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImageUrl(displayImageUrl || null)}
                                        className="pointer-events-auto p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white shadow-md text-xs flex items-center gap-1.5 backdrop-blur transition-all cursor-pointer"
                                        title="Perbesar Gambar"
                                      >
                                        <Maximize2 className="h-3.5 w-3.5" />
                                        <span>Perbesar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadImage(displayImageUrl!, msg.session_title || 'gambar_ai')}
                                        className="pointer-events-auto p-2 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white shadow-md text-xs flex items-center gap-1.5 backdrop-blur transition-all cursor-pointer"
                                        title="Unduh Gambar HD"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Unduh</span>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1 text-blue-400 font-medium">
                                      <Sparkles className="h-3 w-3 text-amber-300" />
                                      Ilustrasi Visual AI (Diagram HD Edukasi)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadImage(displayImageUrl!, msg.session_title || 'gambar_ai')}
                                      className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Simpan ke Perangkat"
                                    >
                                      <Download className="h-3 w-3" />
                                      Simpan HD
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Footer Info & Action Buttons */}
                              <div
                                className={`flex items-center justify-between pt-1 border-t ${
                                  msg.sender === 'user'
                                    ? 'border-white/15 text-blue-200'
                                    : 'border-slate-700/60 text-slate-400'
                                }`}
                              >
                                <span className="text-[10px]">{msg.timestamp}</span>

                                {msg.sender === 'ai' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(msg.id, displayText)}
                                      className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                      title="Salin Teks"
                                    >
                                      {copiedId === msg.id ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => exportAiContentToPdf(displayText, currentRole, msg.session_title, displayImageUrl)}
                                      className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                                      title="Cetak PDF Soal/Materi Beserta Gambar"
                                    >
                                      <FileDown className="h-3 w-3" />
                                    </button>
                                    {displayImageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadImage(displayImageUrl!, msg.session_title || 'gambar_ai')}
                                        className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-blue-300 transition-colors cursor-pointer"
                                        title="Unduh File Gambar HD"
                                      >
                                        <Download className="h-3 w-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                      title="Hapus Pesan Ini"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}

                        {/* User Avatar */}
                        {msg.sender === 'user' && (
                          <div className="h-7 w-7 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-slate-200">
                            {(profile?.nama || user?.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Loading Typing Indicator */}
                    {isLoading && (
                      <div className="flex gap-3 justify-start items-center animate-in fade-in">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shrink-0 shadow-xs">
                          <Sparkles className="h-3.5 w-3.5 text-white animate-spin" />
                        </div>
                        <div className="bg-slate-800/90 border border-slate-700/60 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-300 flex items-center gap-2.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                          <span>
                            {isImageMode 
                              ? 'Gemini & AI Visual sedang membuat materi dan menghasilkan gambar HD...' 
                              : 'Gemini AI sedang berpikir & menyusun jawaban tuntas...'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Bottom Floating Input Bar (Gemini Style) */}
              <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 shrink-0">
                <div className="max-w-3xl mx-auto space-y-2">
                  {/* Indicator Mode Gambar jika aktif */}
                  {isImageMode && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-200 text-xs animate-in fade-in">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-300 animate-pulse" />
                        <span className="font-semibold text-[11px]">Mode Gambar AI Aktif:</span>
                        <span className="text-[11px] text-purple-300">
                          AI akan membuat teks penjelasan serta menghasilkan gambar visual HD (Gratis & Unlimited)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsImageMode(false)}
                        className="p-0.5 rounded hover:bg-purple-900 text-purple-400 hover:text-white cursor-pointer"
                        title="Nonaktifkan Mode Gambar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className="relative flex items-center rounded-2xl bg-slate-900 border border-slate-750 focus-within:border-blue-500/80 shadow-inner transition-colors">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        isImageMode
                          ? 'Tulis deskripsi gambar yang ingin dibuat (misal: anatomi organ tubuh, tata surya, pecahan matematika)...'
                          : `Tanyakan apa saja kepada ${config.title}... (bisa minta buatkan gambar)`
                      }
                      disabled={isLoading}
                      className="w-full resize-none py-3.5 pl-4 pr-24 text-xs sm:text-sm bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none max-h-32"
                    />

                    {/* Tombol Aksi di Kanan Input Bar */}
                    <div className="absolute right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsImageMode(!isImageMode)}
                        className={`p-1.5 px-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isImageMode
                            ? 'bg-purple-600 text-white shadow-xs shadow-purple-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                        title="Aktifkan Mode Gambar AI (Gratis & Unlimited)"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span className="text-[11px] hidden sm:inline font-medium">Buat Gambar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={isLoading || !prompt.trim()}
                        className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow-xs transition-all cursor-pointer"
                        title="Kirim Pertanyaan"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-center text-slate-500">
                    Asisten AI HRIS PADI TECH bertenaga Gemini & Flux Visual. Bebas kuota (gratis & unlimited), tersimpan otomatis di database Supabase.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Modal Fullscreen untuk Preview Gambar AI */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)} 
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl p-3 overflow-hidden shadow-2xl flex flex-col items-center"
          >
            <div className="w-full flex justify-between items-center px-2 py-1.5 border-b border-slate-800 mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Gambar Ilustrasi AI Resolusi Penuh (Flux HD)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadImage(previewImageUrl, 'gambar_ai_hris')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh HD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <img
              src={previewImageUrl}
              alt="Preview Gambar AI"
              className="max-h-[75vh] w-auto object-contain rounded-xl shadow-inner"
            />
          </div>
        </div>
      )}
    </>
  )
}
