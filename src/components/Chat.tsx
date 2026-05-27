import { useState, useEffect, useRef, useCallback } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import { open } from "@tauri-apps/api/shell"
import { listen } from "@tauri-apps/api/event"
import { buildSystemPrompt, saveMemory, loadMemory, ConversationMessage } from "./Onboarding"
import {
  loadCredentials, getAuthUrl, exchangeCodeForTokens, saveTokens,
  loadTokens, getValidAccessToken, getUnreadEmails, formatEmailsForAlan
} from "../gmailService"

const ALAN_AVATAR = "/icon.png"
const GROQ_API_KEY = "GROQ_API_KEY_HERE"
const GEMINI_API_KEY = "AIzaSyAhtLOsOJErzgjWu2PZ9qfsDbboGW7amUg"
const SUPABASE_URL = "https://xwbrohzybbtkhusxlrty.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3YnJvaHp5YmJ0a2h1c3hscnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDMxNTcsImV4cCI6MjA5NTA3OTE1N30.Eta_x1sL3I9AWBldjje69girt1rNjksF43gKiv9drRU"
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/dynamic-endpoint`

const USER_PLAN: string = "quantum"

const MESSAGE_LIMITS: Record<string, number> = {
  free: 10,
  core: 300,
  advanced: 300,
  quantum: Infinity
}

type Profile = Record<string, string>
interface Message { id: number; sender: string; text: string }

function splitIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let current = ""
  for (const s of sentences) {
    if ((current + s).length > 500) {
      if (current.trim()) chunks.push(current.trim())
      current = s
    } else { current += s }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length > 0 ? chunks : [text]
}

function detectEmailIntent(text: string): string | null {
  const t = text.toLowerCase()
  if (!(t.includes('correo') || t.includes('email') || t.includes('gmail') || t.includes('mail'))) return null
  if (t.includes('conecta') || t.includes('configura') || t.includes('autoriza')) return 'connect'
  if (t.includes('lee') || t.includes('leer') || t.includes('ver') || t.includes('muestra') || t.includes('tengo') || t.includes('nuevo')) return 'read'
  if (t.includes('envia') || t.includes('envía') || t.includes('manda') || t.includes('escribe')) return 'compose'
  return null
}

function getTodayMessageCount(): number {
  const today = new Date().toDateString()
  const stored = localStorage.getItem('alan_msg_count')
  if (!stored) return 0
  const { date, count } = JSON.parse(stored)
  if (date !== today) return 0
  return count
}

function incrementMessageCount() {
  const today = new Date().toDateString()
  const count = getTodayMessageCount() + 1
  localStorage.setItem('alan_msg_count', JSON.stringify({ date: today, count }))
}

async function callGemini(systemPrompt: string, messages: {role: string, content: string}[]): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }))
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    })
  })
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude procesar esa solicitud."
}

async function callClaude(systemPrompt: string, messages: {role: string, content: string}[], plan: string): Promise<string> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ messages, systemPrompt, plan })
  })
  if (!res.ok) throw new Error(`Claude error ${res.status}`)
  const data = await res.json()
  return data.text || "No pude procesar esa solicitud."
}

export default function Chat({ profile }: { profile: Profile }) {
  const name = profile.nickname || profile.fullName || profile.name || "usuario"

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: "alan", text: `Sistemas en línea. Hola ${name}, estoy listo. ¿En qué te ayudo hoy?` }
  ])
  const [memory] = useState<ConversationMessage[]>(() => loadMemory())
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [voiceBars, setVoiceBars] = useState<number[]>([8,8,8,8,8])
  const [gmailConnected, setGmailConnected] = useState(false)
  const [msgCount, setMsgCount] = useState(getTodayMessageCount())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const voiceIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const hasGreeted = useRef(false)
  const messagesRef = useRef<Message[]>(messages)
  const speakQueueRef = useRef<string[]>([])

  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    if (messages.length <= 1) return
    saveMemory(messages.map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
      timestamp: m.id
    })))
  }, [messages])

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (hasGreeted.current) return
    hasGreeted.current = true
    setTimeout(() => speakText(`Sistemas en línea. Hola ${name}, estoy listo.`), 1200)
    if (loadTokens()) setGmailConnected(true)
    listen("gmail-auth-code", async (event: any) => {
      await handleGmailCallback(event.payload as string)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isThinking])

  useEffect(() => {
    if (isListening) {
      voiceIntervalRef.current = setInterval(() => {
        setVoiceBars(Array.from({ length: 5 }, () => Math.floor(Math.random() * 28) + 4))
      }, 100)
    } else {
      clearInterval(voiceIntervalRef.current)
      setVoiceBars([8,8,8,8,8])
    }
    return () => clearInterval(voiceIntervalRef.current)
  }, [isListening])

  const playNextChunk = useCallback(() => {
    if (speakQueueRef.current.length === 0) { setIsSpeaking(false); return }
    const chunk = speakQueueRef.current.shift()!
    const utt = new SpeechSynthesisUtterance(chunk)
    utt.lang = "es-ES"
    utt.rate = 0.82
    utt.pitch = 0.65
    utt.volume = 1.0
    const jorge = window.speechSynthesis.getVoices().find(v => v.name === "Jorge")
    if (jorge) utt.voice = jorge
    utt.onend = () => playNextChunk()
    utt.onerror = () => playNextChunk()
    window.speechSynthesis.speak(utt)
  }, [])

  const speakText = useCallback((text: string) => {
    if (!text?.trim() || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    speakQueueRef.current = splitIntoChunks(text)
    setIsSpeaking(true)
    setTimeout(() => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        playNextChunk()
      } else {
        window.speechSynthesis.onvoiceschanged = () => playNextChunk()
      }
    }, 100)
  }, [playNextChunk])

  const startListening = useCallback(async () => {
    if (isListening) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setIsListening(false)
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(blob)
      }
      mediaRecorder.start()
      setIsListening(true)
    } catch(err: any) {
      setIsListening(false)
      console.error("MIC ERROR:", err?.message || err)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) mediaRecorderRef.current.stop()
  }, [isListening])

  const transcribeAudio = async (blob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('file', blob, 'audio.webm')
      formData.append('model', 'whisper-large-v3')
      formData.append('language', 'es')
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: formData
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.text?.trim()) sendMessageDirect(data.text.trim())
    } catch(_) {}
  }

  const addAlanMessage = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now(), sender: "alan", text }])
  }

  const connectGmail = async () => {
    const creds = loadCredentials()
    if (!creds) { addAlanMessage("No encuentro las credenciales de Gmail."); return }
    addAlanMessage("Abriendo el navegador para conectar tu Gmail. Autoriza el acceso y vuelve aquí.")
    await invoke("gmail_start_server")
    await open(getAuthUrl(creds))
  }

  const handleGmailCallback = async (code: string) => {
    const creds = loadCredentials()
    if (!creds) return
    try {
      const tokens = await exchangeCodeForTokens(code, creds)
      if (tokens.expires_in) tokens.expiry_date = Date.now() + tokens.expires_in * 1000
      saveTokens(tokens)
      setGmailConnected(true)
      addAlanMessage("¡Gmail conectado! Ya puedo leer y enviar tus correos.")
      speakText("Gmail conectado.")
    } catch(_) { addAlanMessage("Error al conectar Gmail.") }
  }

  const readEmails = async () => {
    const creds = loadCredentials()
    if (!creds) { addAlanMessage("Gmail no configurado."); return }
    const token = await getValidAccessToken(creds)
    if (!token) { addAlanMessage("Tu Gmail no está conectado. ¿Quieres conectarlo?"); return }
    addAlanMessage("Revisando tu bandeja...")
    try {
      const emails = await getUnreadEmails(token, 5)
      addAlanMessage(`Tienes ${emails.length} correos sin leer:\n\n${formatEmailsForAlan(emails)}`)
      speakText(`Tienes ${emails.length} correos sin leer.`)
    } catch(_) { addAlanMessage("No pude acceder. Reconecta Gmail."); setGmailConnected(false) }
  }

  const sendMessageDirect = async (text: string) => {
    if (!text.trim()) return

    const limit = MESSAGE_LIMITS[USER_PLAN] || 10
    if (msgCount >= limit) {
      addAlanMessage(`Has alcanzado el límite de ${limit} mensajes de tu plan. Actualiza tu plan para continuar.`)
      return
    }

    const userMsg: Message = { id: Date.now(), sender: "user", text: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setIsThinking(true)
    incrementMessageCount()
    setMsgCount(prev => prev + 1)

    const emailIntent = detectEmailIntent(text)
    if (emailIntent) {
      setIsThinking(false)
      if (emailIntent === 'connect') { await connectGmail(); return }
      if (emailIntent === 'read') { await readEmails(); return }
      if (emailIntent === 'compose') { addAlanMessage("Para enviar un correo dime: destinatario, asunto y mensaje."); return }
    }

    const sessionHistory = [...messagesRef.current, userMsg].slice(-16).map(m => ({
      role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.text
    }))

    const memoryContext = memory.length > 0
      ? `\n\nCONVERSACIONES ANTERIORES:\n` +
        memory.slice(-15).map(m => `${m.role === "user" ? name : "ALAN"}: ${m.content}`).join("\n")
      : ""

    const systemPrompt = buildSystemPrompt(profile) + memoryContext

    try {
      let alanText = ""
      if (USER_PLAN === "free") {
        alanText = await callGemini(systemPrompt, sessionHistory)
      } else {
        alanText = await callClaude(systemPrompt, sessionHistory, USER_PLAN)
      }
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: "alan", text: alanText }])
      setIsThinking(false)
      speakText(alanText)
    } catch(e: any) {
      try {
        const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "system", content: systemPrompt }, ...sessionHistory],
            max_tokens: 1024,
            temperature: 0.7
          })
        })
        if (!res2.ok) throw new Error()
        const data2 = await res2.json()
        const alanText2 = data2.choices?.[0]?.message?.content || "Error de conexión."
        setMessages(prev => [...prev, { id: Date.now() + 1, sender: "alan", text: alanText2 }])
        setIsThinking(false)
        speakText(alanText2)
      } catch {
        setMessages(prev => [...prev, { id: Date.now() + 1, sender: "alan", text: "Error de conexión. Intenta de nuevo." }])
        setIsThinking(false)
      }
    }
  }

  const sendMessage = () => {
    if (!input.trim() || isThinking) return
    const text = input.trim()
    setInput("")
    sendMessageDirect(text)
  }

  const timeStr = currentTime.toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit", second:"2-digit" })
  const dateStr = currentTime.toLocaleDateString("es-ES", { weekday:"long", day:"numeric", month:"long" })
  const limit = MESSAGE_LIMITS[USER_PLAN]
  const msgsLeft = limit === Infinity ? "∞" : `${limit - msgCount}`

  return (
    <div className="jarvis">
      <div className="j-left">
        <div className="j-avatar-wrap">
          <div className="j-ring jr1"></div>
          <div className="j-ring jr2"></div>
          <div className="j-ring jr3"></div>
          <div className="j-avatar-img"><img src={ALAN_AVATAR} alt="ALAN"/></div>
          {isSpeaking && <div className="j-speaking-ring"></div>}
        </div>
        <div className="j-name">ALAN AI</div>
        <div className={`j-status-line ${isThinking?'thinking':isSpeaking?'speaking':'online'}`}>
          <span className="j-status-dot"></span>
          {isThinking?"Procesando...":isSpeaking?"Hablando...":"En línea"}
        </div>
        <div className="j-clock">{timeStr}</div>
        <div className="j-date">{dateStr}</div>
        <div className="j-metrics">
          {[["POTENCIA","88%"],["MEMORIA","62%"],["RED","95%"]].map(([l,v])=>(
            <div key={l} className="j-metric">
              <span className="j-metric-label">{l}</span>
              <div className="j-metric-bar"><div className="j-metric-fill" style={{width:v}}></div></div>
            </div>
          ))}
          <div className="j-metric">
            <span className="j-metric-label">VOZ</span>
            <div className="j-metric-bar">
              <div className="j-metric-fill" style={{width:isSpeaking?'80%':isListening?'100%':'20%',background:isListening?'#00ff88':undefined,transition:'width .3s'}}></div>
            </div>
          </div>
        </div>
        <div className="j-profile-box">
          <div className="j-profile-title">PERFIL ACTIVO</div>
          <div className="j-profile-row"><span>NOMBRE</span><span>{name}</span></div>
          {profile.profession&&<div className="j-profile-row"><span>TRABAJO</span><span>{profile.profession}</span></div>}
          {profile.currentLocation&&<div className="j-profile-row"><span>CIUDAD</span><span>{profile.currentLocation}</span></div>}
          {memory.length>0&&<div className="j-profile-row"><span>MEMORIA</span><span>{memory.length} msgs</span></div>}
          <div className="j-profile-row"><span>PLAN</span><span style={{color:"#00ff88",textTransform:"uppercase"}}>{USER_PLAN}</span></div>
          <div className="j-profile-row"><span>MENSAJES</span><span style={{color: msgsLeft === "0" ? "#ff5050" : "#00d2ff"}}>{msgsLeft} restantes</span></div>
        </div>
        <button className="j-reset-btn" onClick={()=>{
          setMessages([{ id: 1, sender: "alan", text: `Sistemas en línea. Hola ${name}, estoy listo. ¿En qué te ayudo hoy?` }])
          localStorage.removeItem("alan_msg_count")
        }}>↺ Nuevo chat</button>
        <button className="j-reset-btn" style={{marginTop:4,borderColor:"rgba(255,80,80,0.2)",color:"rgba(255,80,80,0.35)"}} onClick={()=>{
          if(window.confirm("¿Borrar perfil y volver al inicio?")) {
            localStorage.removeItem("alan_profile_v3")
            localStorage.removeItem("alan_memory_v1")
            localStorage.removeItem("alan_gmail_tokens")
            localStorage.removeItem("alan_msg_count")
            window.location.reload()
          }
        }}>⚙ Reiniciar perfil</button>
      </div>

      <div className="j-center">
        <div className="j-chat-header">
          <div className="j-chat-title">CENTRO DE COMANDO</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div
              style={{
                display:"flex",alignItems:"center",gap:5,
                fontSize:10,fontFamily:"Share Tech Mono,monospace",
                color:gmailConnected?"#00ff88":"rgba(0,210,255,0.5)",
                letterSpacing:1,cursor:"pointer",
                border:`1px solid ${gmailConnected?"rgba(0,255,136,0.3)":"rgba(0,210,255,0.2)"}`,
                borderRadius:4,padding:"3px 8px",
                background:gmailConnected?"rgba(0,255,136,0.06)":"rgba(0,210,255,0.04)",
                transition:"all .2s"
              }}
              onClick={!gmailConnected?connectGmail:undefined}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              {gmailConnected?"CORREO ✓":"CORREO"}
            </div>
          </div>
        </div>
        <div className="j-messages">
          {messages.map(msg=>(
            <div key={msg.id} className={`j-msg-row ${msg.sender==='user'?'j-row-user':'j-row-alan'}`}>
              <div className={`j-bubble ${msg.sender==='user'?'j-bub-user':'j-bub-alan'}`}>{msg.text}</div>
            </div>
          ))}
          {isThinking&&(
            <div className="j-msg-row j-row-alan">
              <div className="j-bubble j-bub-alan j-thinking"><span></span><span></span><span></span></div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>
        <div className="j-input-area">
          <div className="j-input-hint">ENTER · ENVIAR &nbsp;&nbsp; 🎤 MANTÉN PARA HABLAR</div>
          <div className="j-input-row">
            <span className="j-input-prompt">›</span>
            <input className="j-input"
              placeholder={isListening?"Escuchando... suelta para enviar":"Escríbele a ALAN..."}
              value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}}}
              disabled={isThinking}/>
            <button className={`j-mic-btn ${isListening?'listening':''}`}
              onMouseDown={startListening} onMouseUp={stopListening}
              onTouchStart={startListening} onTouchEnd={stopListening}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </button>
            <button className="j-send-btn" onClick={sendMessage} disabled={isThinking}>
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          {isListening&&(
            <div className="j-voice-bars">
              {voiceBars.map((h,i)=><div key={i} className="j-vbar" style={{height:`${h}px`}}></div>)}
            </div>
          )}
        </div>
        <div className="j-footer-bar">
          <span>{isListening?'● GRABANDO':'MIC LISTO'}</span>
          <span>✦ ALAN AI</span>
          <span>{isThinking?'PROCESANDO...':isSpeaking?'HABLANDO...':'● EN LÍNEA'}</span>
        </div>
      </div>

      <div className="j-right">
        <div className="j-right-title">DIAGNÓSTICO</div>
        <div className="j-diag-section">
          <div className="j-diag-label">MODOS</div>
          {["ANÁLISIS","CÓDIGO","CRYPTO","DISEÑO"].map(m=><div key={m} className="j-diag-btn">{m}</div>)}
        </div>
        <div className="j-diag-section">
          <div className="j-diag-label">ESTADO</div>
          <div className="j-diag-stat"><span>IA</span><span className="j-stat-ok">ACTIVA</span></div>
          <div className="j-diag-stat"><span>VOZ</span><span className="j-stat-ok">{isSpeaking?"HABLANDO":"LISTA"}</span></div>
          <div className="j-diag-stat"><span>MICRO</span><span className={isListening?"j-stat-ok":"j-stat-dim"}>{isListening?"ON":"LISTO"}</span></div>
          <div className="j-diag-stat"><span>CORREO</span><span className={gmailConnected?"j-stat-ok":"j-stat-dim"}>{gmailConnected?"ON":"OFF"}</span></div>
          <div className="j-diag-stat"><span>PLAN</span><span className="j-stat-ok" style={{textTransform:"uppercase"}}>{USER_PLAN}</span></div>
          <div className="j-diag-stat"><span>MEM</span><span className="j-stat-ok">{memory.length}</span></div>
        </div>
        <div className="j-diag-section">
          <div className="j-diag-label">ACCIONES</div>
          <div className="j-diag-btn" onClick={gmailConnected?readEmails:connectGmail}>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" style={{marginRight:4,verticalAlign:"middle"}}>
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            {gmailConnected?"VER CORREOS":"CONECTAR CORREO"}
          </div>
        </div>
        <div className="j-diag-section">
          <div className="j-diag-label">SESIÓN</div>
          <div className="j-diag-info">{messages.length} mensajes</div>
          <div className="j-diag-info">{Object.keys(profile).length} campos</div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Inter:wght@300;400;500&display=swap');
        .jarvis{display:flex;width:100%;height:100%;background:rgba(6,8,14,0.97);color:#e2e8f0;font-family:'Inter',sans-serif;overflow:hidden}
        .j-left{width:220px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding:20px 14px;border-right:1px solid rgba(0,210,255,0.12);background:rgba(0,0,0,0.2);overflow-y:auto;gap:10px}
        .j-avatar-wrap{position:relative;width:130px;height:130px;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
        .j-ring{position:absolute;border-radius:50%;border:1px dashed rgba(0,210,255,0.28)}
        .jr1{width:130px;height:130px;animation:sp 22s linear infinite}
        .jr2{width:108px;height:108px;border-style:dotted;animation:sp 14s linear infinite reverse}
        .jr3{width:86px;height:86px;animation:sp 30s linear infinite}
        .j-avatar-img{position:absolute;width:70px;height:70px;border-radius:50%;overflow:hidden;border:2px solid #00d2ff;box-shadow:0 0 20px rgba(0,210,255,0.4);animation:breathe 4s ease-in-out infinite}
        .j-avatar-img img{width:100%;height:100%;object-fit:cover}
        .j-speaking-ring{position:absolute;width:78px;height:78px;border-radius:50%;border:2px solid #00ff88;box-shadow:0 0 15px rgba(0,255,136,0.5);animation:speakPulse 1s ease-in-out infinite}
        .j-name{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:900;color:#00d2ff;letter-spacing:3px;text-shadow:0 0 10px rgba(0,210,255,0.5)}
        .j-status-line{display:flex;align-items:center;gap:5px;font-size:10px;font-family:'Share Tech Mono',monospace;letter-spacing:1.5px;text-transform:uppercase}
        .j-status-line.online{color:rgba(0,210,255,0.6)}.j-status-line.thinking{color:#fbbf24}.j-status-line.speaking{color:#00ff88}
        .j-status-dot{width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 4px currentColor;animation:pulse 2s infinite}
        .j-clock{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:700;color:#00d2ff;letter-spacing:2px;text-shadow:0 0 10px rgba(0,210,255,0.4);margin-top:4px}
        .j-date{font-size:9px;color:rgba(0,210,255,0.45);font-family:'Share Tech Mono',monospace;letter-spacing:1px;text-align:center;text-transform:capitalize}
        .j-metrics{width:100%;display:flex;flex-direction:column;gap:6px;margin-top:6px}
        .j-metric-label{font-size:9px;font-family:'Share Tech Mono',monospace;color:rgba(0,210,255,0.5);letter-spacing:1.5px;display:block;margin-bottom:2px}
        .j-metric-bar{height:3px;background:rgba(0,210,255,0.1);border-radius:2px;overflow:hidden}
        .j-metric-fill{height:100%;background:linear-gradient(90deg,#00d2ff,#0066ff);border-radius:2px;box-shadow:0 0 4px rgba(0,210,255,0.4);transition:width .5s}
        .j-profile-box{width:100%;background:rgba(0,210,255,0.04);border:1px solid rgba(0,210,255,0.1);border-radius:8px;padding:10px;margin-top:4px}
        .j-profile-title{font-size:9px;font-family:'Share Tech Mono',monospace;color:rgba(0,210,255,0.5);letter-spacing:2px;margin-bottom:8px}
        .j-profile-row{display:flex;justify-content:space-between;gap:4px;margin-bottom:4px;font-size:9px}
        .j-profile-row span:first-child{color:rgba(0,210,255,0.4);font-family:'Share Tech Mono',monospace;flex-shrink:0}
        .j-profile-row span:last-child{color:rgba(226,232,240,0.7);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px}
        .j-reset-btn{background:transparent;border:1px solid rgba(255,80,80,0.25);color:rgba(255,80,80,0.5);font-size:9px;font-family:'Share Tech Mono',monospace;padding:5px 10px;border-radius:6px;cursor:pointer;letter-spacing:1px;transition:all .2s;width:100%;margin-top:auto}
        .j-reset-btn:hover{border-color:rgba(255,80,80,0.5);color:rgba(255,80,80,0.8)}
        .j-center{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .j-chat-header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid rgba(0,210,255,0.1);background:rgba(0,0,0,0.15);flex-shrink:0}
        .j-chat-title{font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#00d2ff;letter-spacing:3px}
        .j-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;position:relative}
        .j-messages::before{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:65%;padding-bottom:65%;background-image:url("/icon.png");background-repeat:no-repeat;background-position:center;background-size:contain;opacity:0.40;pointer-events:none;z-index:0}
        .j-messages > *{position:relative;z-index:1}
        .j-msg-row{display:flex;width:100%}
        .j-row-alan{justify-content:flex-start}.j-row-user{justify-content:flex-end}
        .j-bubble{max-width:75%;padding:11px 15px;border-radius:12px;font-size:13px;line-height:1.55;animation:fu .25s ease both;font-family:'Inter',sans-serif;white-space:pre-wrap;word-break:break-word}
        .j-bub-alan{background:rgba(0,100,255,0.08);border:1px solid rgba(0,210,255,0.16);color:#e2e8f0;border-top-left-radius:3px}
        .j-bub-user{background:rgba(0,210,255,0.11);border:1px solid rgba(0,210,255,0.32);color:#00d2ff;border-top-right-radius:3px;font-family:'Share Tech Mono',monospace;font-size:12px}
        .j-thinking{display:flex;gap:5px;padding:12px 16px;align-items:center}
        .j-thinking span{width:5px;height:5px;background:#00d2ff;border-radius:50%;animation:bo 1.4s infinite ease-in-out both}
        .j-thinking span:nth-child(1){animation-delay:-.32s}.j-thinking span:nth-child(2){animation-delay:-.16s}
        .j-input-area{padding:12px 16px 10px;border-top:1px solid rgba(0,210,255,0.08);flex-shrink:0}
        .j-input-hint{font-size:9px;font-family:'Share Tech Mono',monospace;color:rgba(0,210,255,0.3);letter-spacing:1.5px;margin-bottom:8px}
        .j-input-row{display:flex;align-items:center;gap:8px;background:rgba(10,15,28,0.8);border:1px solid rgba(0,210,255,0.22);border-radius:8px;padding:6px 10px;transition:all .3s}
        .j-input-row:focus-within{border-color:#00d2ff;box-shadow:0 0 12px rgba(0,210,255,0.15)}
        .j-input-prompt{font-family:'Share Tech Mono',monospace;color:#00d2ff;font-size:14px;flex-shrink:0}
        .j-input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-family:'Inter',sans-serif;font-size:13px}
        .j-input::placeholder{color:rgba(255,255,255,0.25)}.j-input:disabled{opacity:0.5}
        .j-mic-btn{background:transparent;border:1px solid rgba(0,210,255,0.25);color:rgba(0,210,255,0.6);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;flex-shrink:0;user-select:none}
        .j-mic-btn:hover,.j-mic-btn.listening{color:#00d2ff;border-color:#00d2ff;box-shadow:0 0 10px rgba(0,210,255,0.3)}
        .j-mic-btn.listening{background:rgba(0,210,255,0.15);animation:micPulse 1s infinite}
        .j-send-btn{background:rgba(0,210,255,0.08);border:1px solid rgba(0,210,255,0.25);color:#00d2ff;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;flex-shrink:0}
        .j-send-btn:hover:not(:disabled){background:#00d2ff;color:#000;box-shadow:0 0 10px #00d2ff}
        .j-send-btn:disabled{opacity:0.3}
        .j-voice-bars{display:flex;align-items:center;gap:3px;height:32px;margin-top:8px;padding:0 4px}
        .j-vbar{width:4px;background:#00d2ff;border-radius:2px;transition:height .1s ease;box-shadow:0 0 4px rgba(0,210,255,0.5);min-height:3px}
        .j-footer-bar{display:flex;justify-content:space-between;padding:6px 16px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(0,210,255,0.06);font-size:9px;font-family:'Share Tech Mono',monospace;color:rgba(0,210,255,0.35);letter-spacing:1.5px}
        .j-right{width:160px;flex-shrink:0;border-left:1px solid rgba(0,210,255,0.1);background:rgba(0,0,0,0.15);padding:16px 12px;display:flex;flex-direction:column;gap:16px;overflow-y:auto}
        .j-right-title{font-family:'Orbitron',sans-serif;font-size:9px;font-weight:700;color:rgba(0,210,255,0.5);letter-spacing:3px;border-bottom:1px solid rgba(0,210,255,0.1);padding-bottom:8px}
        .j-diag-section{display:flex;flex-direction:column;gap:5px}
        .j-diag-label{font-size:9px;font-family:'Share Tech Mono',monospace;color:rgba(0,210,255,0.4);letter-spacing:2px;margin-bottom:2px}
        .j-diag-btn{background:rgba(0,100,255,0.07);border:1px solid rgba(0,210,255,0.15);color:rgba(0,210,255,0.6);font-size:10px;font-family:'Share Tech Mono',monospace;padding:5px 8px;border-radius:4px;cursor:pointer;letter-spacing:1px;transition:all .2s;text-align:center}
        .j-diag-btn:hover{border-color:#00d2ff;color:#00d2ff;background:rgba(0,210,255,0.1)}
        .j-diag-stat{display:flex;justify-content:space-between;font-size:9px;font-family:'Share Tech Mono',monospace;padding:3px 0;border-bottom:1px solid rgba(0,210,255,0.05)}
        .j-diag-stat span:first-child{color:rgba(0,210,255,0.4)}
        .j-stat-ok{color:#00ff88}.j-stat-dim{color:rgba(0,210,255,0.3)}
        .j-diag-info{font-size:9px;font-family:'Share Tech Mono',monospace;color:rgba(0,210,255,0.4);padding:2px 0}
        @keyframes sp{to{transform:rotate(360deg)}}
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bo{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-5px);opacity:1}}
        @keyframes speakPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:0.6}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,210,255,0.4)}70%{box-shadow:0 0 0 8px rgba(0,210,255,0)}}
      `}</style>
    </div>
  )
}
