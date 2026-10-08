import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { exportAiContentToPdf } from '@/lib/aiPdfExporter'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check, 
  Loader2, 
  Trash2, 
  GraduationCap, 
  Video, 
  ShieldCheck,
  Zap,
  HelpCircle,
  FileDown
} from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
}

const ROLE_PRESETS = {
  tutor: {
    title: 'AI Asisten Tutor Bimbel',
    badge: 'Tutor Assistant',
    badgeColor: 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    icon: GraduationCap,
    gradient: 'from-blue-600 to-indigo-600',
    suggestions: [
      'Buatkan 5 soal latihan Matematika pecahan kelas 5 SD beserta kunci jawaban dan cara penyelesaian.',
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
    suggestions: [
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
    suggestions: [
      'Bagaimana strategi meningkatkan omset bimbel dan live commerce secara bersamaan di bulan ini?',
      'Buatkan draf pengumuman resmi ke seluruh karyawan terkait kedisiplinan pengisian laporan harian.',
      'Berikan indikator KPI yang adil dan memotivasi untuk Tutor Bimbel dan Host TikTok Live.',
      'Analisis cara meningkatkan margin profit operasional tanpa mengurangi kualitas pembelajaran.'
    ]
  }
}

export const AiAssistantModal: React.FC = () => {
  const { user, role } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const currentRole = role === 'host' ? 'host' : role === 'owner' ? 'owner' : 'tutor'
  const config = ROLE_PRESETS[currentRole]
  const IconComponent = config.icon

  // Load chat history from Supabase (or localStorage fallback) per user and role
  useEffect(() => {
    let isMounted = true

    async function loadChatHistory() {
      const storageKey = `hris_ai_chat_${user?.id || 'guest'}_${currentRole}`
      const defaultGreeting: Message = {
        id: 'welcome',
        sender: 'ai',
        text: `Halo! Saya adalah **${config.title}** bertenaga AI. Ada materi, soal latihan, ide live streaming, atau strategi yang ingin saya bantu buatkan hari ini? Silakan pilih salah satu ide cepat di atas atau ketik pertanyaan Anda langsung!`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }

      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('ai_chat_history')
            .select('id, message_role, content, created_at')
            .eq('user_id', user.id)
            .eq('role', currentRole)
            .order('created_at', { ascending: true })

          if (!error && data && data.length > 0) {
            const formatted: Message[] = data.map((d: any) => ({
              id: d.id,
              sender: d.message_role === 'user' ? 'user' : 'ai',
              text: d.content,
              timestamp: new Date(d.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            }))
            if (isMounted) {
              setMessages(formatted)
              return
            }
          }
        } catch (err) {
          console.debug('Notice loading Supabase ai_chat_history:', err)
        }
      }

      // Fallback: localStorage
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isMounted) {
              setMessages(parsed)
              return
            }
          }
        } catch {}
      }

      if (isMounted) {
        setMessages([defaultGreeting])
      }
    }

    loadChatHistory()

    return () => {
      isMounted = false
    }
  }, [user?.id, currentRole, config.title])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Save single message to Supabase & localStorage
  const saveMessageToStorage = async (msg: Message, messageRole: 'user' | 'assistant') => {
    const storageKey = `hris_ai_chat_${user?.id || 'guest'}_${currentRole}`

    // 1. Supabase insert
    if (user?.id) {
      try {
        await supabase.from('ai_chat_history').insert({
          user_id: user.id,
          role: currentRole,
          message_role: messageRole,
          content: msg.text,
        })
      } catch (err) {
        console.debug('Notice persisting to ai_chat_history:', err)
      }
    }

    // 2. LocalStorage backup
    try {
      setMessages((current) => {
        const next = [...current, msg]
        try {
          localStorage.setItem(storageKey, JSON.stringify(next.slice(-50)))
        } catch {}
        return next
      })
    } catch {}
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim()
    if (!text || isLoading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }

    setPrompt('')
    await saveMessageToStorage(userMsg, 'user')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          role: currentRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghubungi server asisten AI.')
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer || 'Tidak ada respon yang diterima.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }

      await saveMessageToStorage(aiMsg, 'assistant')
    } catch (err: any) {
      const errorMsg: Message = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `⚠️ Maaf, terjadi kendala: ${err.message || 'Koneksi ke asisten AI terputus.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleClearChat = async () => {
    const storageKey = `hris_ai_chat_${user?.id || 'guest'}_${currentRole}`
    localStorage.removeItem(storageKey)

    if (user?.id) {
      try {
        await supabase
          .from('ai_chat_history')
          .delete()
          .eq('user_id', user.id)
          .eq('role', currentRole)
      } catch (err) {
        console.debug('Notice clearing ai_chat_history:', err)
      }
    }

    setMessages([
      {
        id: 'reset-welcome',
        sender: 'ai',
        text: `Riwayat obrolan dibersihkan. Silakan ajukan pertanyaan atau pilih ide instruksi baru!`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    ])
  }

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r ${config.gradient} text-white font-semibold text-xs shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20`}
        >
          <div className="relative">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span>Tanya AI Asisten</span>
        </button>
      </div>

      {/* AI Assistant Modal Window */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-lg h-[92vh] sm:h-[620px] max-h-[700px] flex flex-col shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden sm:rounded-2xl rounded-t-2xl">
            {/* Header */}
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center space-x-3">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-tr ${config.gradient} flex items-center justify-center text-white shadow-md`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                      {config.title}
                    </CardTitle>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${config.badgeColor}`}>
                      {config.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" /> Bertenaga Google Gemini Multimodel AI
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Bersihkan Percakapan"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            {/* Quick Suggestion Chips */}
            <div className="p-3 border-b bg-slate-50/40 dark:bg-slate-900/40 overflow-x-auto no-scrollbar">
              <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-indigo-500" /> Contoh Ide Cepat:
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {config.suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(sug)}
                    disabled={isLoading}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-all text-left max-w-[240px] truncate shadow-xs"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages Body */}
            <CardContent className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-gradient-to-b from-slate-50/20 to-white dark:from-slate-950 dark:to-slate-900">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${
                    msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600'
                        : `bg-gradient-to-tr ${config.gradient}`
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs group relative ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-tl-xs'
                    }`}
                  >
                    {/* Message Content */}
                    <div className="whitespace-pre-wrap leading-relaxed font-normal">
                      {msg.text}
                    </div>

                    {/* Footer inside bubble */}
                    <div
                      className={`flex items-center justify-between gap-3 mt-1.5 pt-1 border-t text-[10px] ${
                        msg.sender === 'user'
                          ? 'border-indigo-500 text-indigo-200'
                          : 'border-slate-100 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {msg.sender === 'ai' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => exportAiContentToPdf(msg.text, currentRole)}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium text-blue-600 dark:text-blue-400"
                            title="Unduh Soal & Materi ke format PDF"
                          >
                            <FileDown className="h-3 w-3" />
                            <span>Cetak PDF Soal</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-500">Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing Loader Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs bg-gradient-to-tr ${config.gradient}`}>
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-2 shadow-xs">
                    <Loader2 className="h-3.5 w-3.5 text-indigo-600 animate-spin" />
                    <span className="text-slate-600 dark:text-slate-300 animate-pulse font-medium">
                      Asisten AI sedang menyusun materi & soal...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input Footer */}
            <CardFooter className="p-3 border-t bg-slate-50/90 dark:bg-slate-900/90 flex gap-2">
              <Input
                placeholder={`Tanyakan apa saja kepada ${config.title}...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                disabled={isLoading}
                className="text-xs h-9 bg-white dark:bg-slate-950"
              />
              <Button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !prompt.trim()}
                size="sm"
                className={`h-9 px-3.5 bg-gradient-to-r ${config.gradient} text-white shrink-0`}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  )
}
