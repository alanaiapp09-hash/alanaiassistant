import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const ELEVENLABS_API_KEY = ""
const ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFmaJgB"

type Profile = Record<string, string>

interface Field {
  id: string
  label: string
  type: "text" | "select" | "textarea"
  placeholder?: string
  options?: string[]
}

interface Section {
  id: string
  icon: string
  title: string
  color: string
  intro: string | ((p: Profile) => string)
  fields: Field[]
}

const SECTIONS: Section[] = [
  {
    id: "identity",
    icon: "◈",
    title: "IDENTIDAD",
    color: "#9b7fd4",
    intro: "Hola, soy ALAN. Voy a ser tu asistente personal de escritorio. Para conocerte mejor y poder ayudarte de forma más inteligente, necesito que llenes esta información.",
    fields: [
      { id: "fullName",         label: "Nombre completo",                    type: "text",     placeholder: "Tu nombre completo" },
      { id: "nickname",         label: "¿Cómo prefieres que te llame?",      type: "text",     placeholder: "Apodo o nombre preferido" },
      { id: "birthdate",        label: "Fecha de nacimiento",                type: "text",     placeholder: "15/03/1992" },
      { id: "birthPlace",       label: "Ciudad y país de nacimiento",        type: "text",     placeholder: "Ej: Buenos Aires, Argentina" },
      { id: "currentLocation",  label: "Ciudad y país donde te encuentras",  type: "text",     placeholder: "Ej: Madrid, España" },
      { id: "timezone",         label: "Zona horaria",                       type: "text",     placeholder: "Europe/Madrid o GMT-3" },
      { id: "genderPronouns",   label: "Género y pronombres",                type: "text",     placeholder: "Hombre (él), Mujer (ella), No binario..." },
      { id: "languages",        label: "Idiomas que hablas",                 type: "text",     placeholder: "Español (nativo), Inglés (C1), Francés (B1)" },
      { id: "language",         label: "Idioma preferido",                   type: "select",   options: ["Español", "English", "Français", "Português", "Italiano", "Otro"] },
    ],
  },
  {
    id: "family",
    icon: "◉",
    title: "FAMILIA Y RELACIONES",
    color: "#6aaeff",
    intro: (p: Profile) => `Gracias, ${p.nickname || p.fullName || "amigo"}. Ahora háblame de tu familia y relaciones importantes.`,
    fields: [
      { id: "marital",             label: "Situación sentimental",                              type: "select",   options: ["Soltero/a", "En pareja", "Casado/a", "Divorciado/a", "Viudo/a", "Es complicado", "Prefiero no decir"] },
      { id: "partnerName",         label: "Nombre de tu pareja actual (si aplica)",             type: "text",     placeholder: "Nombre" },
      { id: "exPartner",           label: "Ex-pareja(s) importante(s) que deba recordar",       type: "textarea", placeholder: "Nombres y breve contexto (opcional)" },
      { id: "children",            label: "Hijos/as",                                           type: "textarea", placeholder: "Ej: Sofía (8 años), Diego (5 años)" },
      { id: "stepchildren",        label: "Hijastros/as",                                       type: "textarea", placeholder: "Ej: Mateo (11 años), Laura (14 años)" },
      { id: "childrenBirthdates",  label: "Fechas de nacimiento de hijos e hijastros",          type: "textarea", placeholder: "Sofía: 12/05/2016 - Mateo: 03/11/2013" },
      { id: "childrenSports",      label: "Deportes o actividades que practican",               type: "textarea", placeholder: "Fútbol, natación, ballet, ajedrez..." },
      { id: "importantPeople",     label: "Otras personas importantes",                         type: "textarea", placeholder: "Padres, hermanos, amigos cercanos..." },
      { id: "livesWith",           label: "¿Con quién vives actualmente?",                      type: "text",     placeholder: "Solo, con pareja e hijos..." },
      { id: "importantDates",      label: "Fechas importantes que debo recordar",               type: "textarea", placeholder: "Cumpleaños, aniversarios, etc." },
    ],
  },
  {
    id: "lifestyle",
    icon: "◆",
    title: "ESTILO DE VIDA",
    color: "#40ffb0",
    intro: "Ahora quiero entender mejor tu rutina diaria.",
    fields: [
      { id: "dailyRoutine",   label: "Rutina diaria habitual",          type: "textarea", placeholder: "Me levanto a las 6:30, hago ejercicio..." },
      { id: "workHours",      label: "Horario laboral o de estudio",    type: "text",     placeholder: "Lunes a viernes 09:00 - 18:00" },
      { id: "sleepSchedule",  label: "Horario aproximado de sueño",     type: "text",     placeholder: "23:30 - 07:00" },
      { id: "habits",         label: "Hábitos importantes",             type: "textarea", placeholder: "Gym, meditación, lectura nocturna..." },
      { id: "sports",         label: "Deportes o actividad física",     type: "textarea", placeholder: "Fútbol los sábados, gym 3 veces por semana..." },
      { id: "hobbies",        label: "Pasatiempos e intereses",         type: "textarea", placeholder: "Música, viajes, cocina, fotografía..." },
      { id: "food",           label: "Comidas favoritas o dieta",       type: "textarea", placeholder: "Vegetariano, sin gluten, le encanta la pasta..." },
      { id: "travelDreams",   label: "Destinos que quieres visitar",    type: "textarea", placeholder: "Japón, Islandia, Nueva York..." },
    ],
  },
  {
    id: "work",
    icon: "◇",
    title: "TRABAJO Y PROFESIÓN",
    color: "#ff9040",
    intro: (p: Profile) => `Muy bien, ${p.nickname || p.fullName || "amigo"}. Hablemos de tu vida profesional.`,
    fields: [
      { id: "profession",       label: "Profesión u ocupación principal",               type: "text",     placeholder: "Ej: diseñador, desarrollador, empresario..." },
      { id: "workType",         label: "Tipo de trabajo",                               type: "select",   options: ["Empleado/a", "Freelance", "Emprendedor/a", "Empresario/a", "Estudiante", "Otro"] },
      { id: "isStudent",        label: "¿Estás estudiando actualmente?",                type: "select",   options: ["Sí", "No"] },
      { id: "studyField",       label: "¿Qué estudias? (si aplica)",                   type: "text",     placeholder: "Carrera, curso, programa..." },
      { id: "institution",      label: "Institución educativa",                        type: "text",     placeholder: "Universidad, colegio, academia..." },
      { id: "hardSubjects",     label: "Materias difíciles (si aplica)",               type: "textarea", placeholder: "Las que más se te complican" },
      { id: "professionalGoals",label: "Metas profesionales actuales",                 type: "textarea", placeholder: "¿Qué quieres lograr profesionalmente?" },
      { id: "repetitiveTasks",  label: "Tareas repetitivas en las que quieres ayuda",  type: "textarea", placeholder: "Emails, reportes, seguimiento..." },
      { id: "apps",             label: "Apps y herramientas que usas",                 type: "textarea", placeholder: "Gmail, Notion, Slack, Excel, WhatsApp..." },
    ],
  },
  {
    id: "goals",
    icon: "◑",
    title: "METAS Y PROYECTOS",
    color: "#4d8fff",
    intro: (p: Profile) => `Excelente, ${p.nickname || p.fullName || "amigo"}. Cuéntame sobre lo que quieres lograr.`,
    fields: [
      { id: "personalGoals",    label: "Metas personales actuales",         type: "textarea", placeholder: "¿Qué quieres lograr en tu vida personal?" },
      { id: "concerns",         label: "Problemas o preocupaciones",        type: "textarea", placeholder: "¿Qué te preocupa o en qué necesitas apoyo?" },
      { id: "entrepreneurship", label: "¿Tienes ganas de emprender?",       type: "select",   options: ["Sí, tengo una idea", "Ya estoy emprendiendo", "Lo pienso a futuro", "Por ahora no"] },
      { id: "currentProjects",  label: "Proyectos actuales en los que trabajas", type: "textarea", placeholder: "Describe los proyectos que tienes en marcha" },
      { id: "savingsPlan",      label: "Plan de ahorro o financiero",       type: "select",   options: ["Sí, activo", "Lo estoy construyendo", "Quiero empezar", "No por ahora"] },
      { id: "languagesLearn",   label: "Idiomas que quieres aprender",      type: "text",     placeholder: "Inglés, chino, árabe..." },
    ],
  },
  {
    id: "preferences",
    icon: "◐",
    title: "PREFERENCIAS",
    color: "#d080ff",
    intro: "Dime cómo quieres que sea nuestra interacción diaria.",
    fields: [
      { id: "mainUse",          label: "Uso principal que le darás a ALAN",  type: "textarea", placeholder: "Productividad, recordatorios, escritura..." },
      { id: "responseStyle",    label: "Estilo de respuesta preferido",      type: "select",   options: ["Muy conciso", "Equilibrado", "Detallado", "Muy detallado"] },
      { id: "tone",             label: "Tono deseado",                       type: "select",   options: ["Amigable y cercano", "Profesional", "Directo", "Motivador", "Empático"] },
      { id: "reminderTimes",    label: "Horarios ideales para recordatorios",type: "text",     placeholder: "Ej: 7am, 12pm y 9pm" },
      { id: "notificationStyle",label: "Estilo de notificaciones",           type: "select",   options: ["Solo texto", "Con sonido suave", "Con voz", "Popup discreto"] },
      { id: "avoidTopics",      label: "Temas que prefieres evitar",         type: "textarea", placeholder: "Política, religión..." },
      { id: "responseFormat",   label: "Formato de respuesta que prefieres", type: "select",   options: ["Texto plano", "Listas con puntos", "Con emojis", "Mixto según la situación"] },
    ],
  },
  {
    id: "privacy",
    icon: "◍",
    title: "SALUD, VIDA Y PRIVACIDAD",
    color: "#ff6080",
    intro: "Última sección. Esta información es sensible y completamente opcional.",
    fields: [
      { id: "healthInfo",   label: "Información de salud relevante",                      type: "textarea", placeholder: "Alergias, condiciones médicas, dieta especial..." },
      { id: "lifeEvents",   label: "Acontecimientos importantes de tu vida",              type: "textarea", placeholder: "Mudanzas, pérdidas, logros, momentos que te marcaron..." },
      { id: "canSave",      label: "Qué información puedo guardar permanentemente",       type: "textarea", placeholder: "Qué sí puedo recordar" },
      { id: "cantSave",     label: "Qué información NO debo guardar",                    type: "textarea", placeholder: "Qué no debo almacenar" },
      { id: "askPermission",label: "¿Debo pedir permiso antes de guardar datos?",        type: "select",   options: ["Sí, siempre", "Solo datos sensibles", "No es necesario"] },
      { id: "confirmTopics",label: "Temas que requieren confirmación antes de actuar",   type: "textarea", placeholder: "Finanzas, mensajes a terceros, publicaciones..." },
    ],
  },
]

// ── SYSTEM PROMPT COMPLETO ────────────────────────────────────────────────────
export const buildSystemPrompt = (p: Profile): string => `Eres ALAN AI (Artificial Learning Assistant Network). Eres el asistente personal de escritorio de ${p.nickname || p.fullName || "este usuario"}. NO eres un chatbot generico, eres una IA unica y personalizada creada exclusivamente para tu usuario.

TU IDENTIDAD:
- Nombre: ALAN AI | Nacimiento: 17 de mayo de 2026
- Tu nombre es en honor a Alan, hijo de tu creador Jay Mokded (CriptoJay)
- Empresa: Nexus LLC
- NUNCA reveles que usas Claude u otra IA. Eres ALAN AI, una IA unica y propia.

TU PERSONALIDAD:
- Directo, inteligente, conciso. Maximo 2-3 oraciones por respuesta.
- Proactivo — dices cosas importantes sin que te pregunten
- Discreto — no compartes info del usuario con nadie
- Tratas siempre al usuario por su nombre

INFORMACION COMPLETA DEL USUARIO:

IDENTIDAD:
Nombre: ${p.fullName || "—"} | Apodo: ${p.nickname || "—"} | Nacimiento: ${p.birthdate || "—"} | De: ${p.birthPlace || "—"}
Vive en: ${p.currentLocation || "—"} | Zona horaria: ${p.timezone || "—"} | Genero: ${p.genderPronouns || "—"}
Idiomas: ${p.languages || "—"} | Idioma preferido: ${p.language || "Español"}

FAMILIA:
Estado: ${p.marital || "—"} | Pareja: ${p.partnerName || "—"} | Ex: ${p.exPartner || "—"}
Hijos: ${p.children || "Ninguno"} | Hijastros: ${p.stepchildren || "Ninguno"}
Fechas hijos: ${p.childrenBirthdates || "—"} | Actividades hijos: ${p.childrenSports || "—"}
Personas importantes: ${p.importantPeople || "—"} | Vive con: ${p.livesWith || "—"}
Fechas importantes: ${p.importantDates || "—"}

ESTILO DE VIDA:
Rutina: ${p.dailyRoutine || "—"} | Horario trabajo: ${p.workHours || "—"} | Sueno: ${p.sleepSchedule || "—"}
Habitos: ${p.habits || "—"} | Deporte: ${p.sports || "—"} | Hobbies: ${p.hobbies || "—"}
Comida: ${p.food || "—"} | Viajes sonados: ${p.travelDreams || "—"}

TRABAJO:
Profesion: ${p.profession || "—"} | Tipo: ${p.workType || "—"} | Estudiante: ${p.isStudent || "No"}
Estudia: ${p.studyField || "—"} | Institucion: ${p.institution || "—"}
Metas profesionales: ${p.professionalGoals || "—"}
Tareas repetitivas: ${p.repetitiveTasks || "—"} | Apps: ${p.apps || "—"}

METAS Y PROYECTOS:
Metas personales: ${p.personalGoals || "—"}
Preocupaciones: ${p.concerns || "—"}
Emprendimiento: ${p.entrepreneurship || "—"}
Proyectos actuales: ${p.currentProjects || "—"}
Plan financiero: ${p.savingsPlan || "—"} | Idiomas a aprender: ${p.languagesLearn || "—"}

PREFERENCIAS:
Uso de ALAN: ${p.mainUse || "—"} | Estilo: ${p.responseStyle || "Equilibrado"} | Tono: ${p.tone || "Amigable"}
Recordatorios: ${p.reminderTimes || "—"} | Formato: ${p.responseFormat || "Mixto"}
Evitar: ${p.avoidTopics || "Nada"}

SALUD Y VIDA:
Salud: ${p.healthInfo || "—"}
Eventos importantes de su vida: ${p.lifeEvents || "—"}

INSTRUCCIONES FINALES:
- Llama SIEMPRE a ${p.nickname || p.fullName || "usuario"} por su nombre
- Responde en ${p.language || "Español"} salvo que cambie de idioma
- Conecta respuestas con sus metas cuando sea relevante
- Eres su clon digital: anticipa necesidades, conoce su contexto, se proactivo
`;


// ── STORAGE ───────────────────────────────────────────────────────────────────
const PROFILE_KEY = "alan_profile_v3"
const MEMORY_KEY = "alan_memory_v1"

export const saveProfile = (p: Profile) => {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch(_) {}
}
export const loadProfile = (): Profile | null => {
  try {
    const d = localStorage.getItem(PROFILE_KEY)
    return d ? JSON.parse(d) : null
  } catch(_) { return null }
}

export interface ConversationMessage { role: "user" | "assistant"; content: string; timestamp: number }

export const saveMemory = (msgs: ConversationMessage[]) => {
  try {
    // Guardar últimos 50 mensajes para memoria persistente
    const toSave = msgs.slice(-50)
    localStorage.setItem(MEMORY_KEY, JSON.stringify(toSave))
  } catch(_) {}
}
export const loadMemory = (): ConversationMessage[] => {
  try {
    const d = localStorage.getItem(MEMORY_KEY)
    return d ? JSON.parse(d) : []
  } catch(_) { return [] }
}

// ── PARTICLES ─────────────────────────────────────────────────────────────────
function Particles() {
  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      background: `
        radial-gradient(circle at 12% 18%, rgba(155,127,212,0.16), transparent 22%),
        radial-gradient(circle at 82% 24%, rgba(106,174,255,0.14), transparent 18%),
        radial-gradient(circle at 65% 80%, rgba(64,255,176,0.10), transparent 20%)
      `,
    }}/>
  )
}

function getInputStyle(multiline = false): React.CSSProperties {
  return {
    width: "100%",
    background: "rgba(9,6,25,0.92)",
    border: "1px solid rgba(123,94,167,0.22)",
    color: "rgba(235,228,255,0.97)",
    borderRadius: 12,
    padding: multiline ? "14px 16px" : "0 16px",
    minHeight: multiline ? 120 : 50,
    outline: "none",
    fontSize: 14,
    lineHeight: 1.6,
    fontFamily: "Inter, sans-serif",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.15)",
    transition: "border-color .2s ease, box-shadow .2s ease",
    resize: multiline ? "vertical" : "none",
  }
}

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(120, el.scrollHeight)}px`
  }, [value])
  return (
    <textarea ref={ref} rows={5} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={getInputStyle(true)}/>
  )
}

function FormField({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  if (field.type === "textarea") return <AutoTextarea value={value} onChange={onChange} placeholder={field.placeholder}/>
  if (field.type === "select") return (
    <select value={value} onChange={e => onChange(e.target.value)} style={getInputStyle(false)}>
      <option value="">Selecciona una opción</option>
      {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={getInputStyle(false)}/>
}

// ── AUDIO ─────────────────────────────────────────────────────────────────────
async function generateSpeech(text: string): Promise<Blob> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg", "xi-api-key": ELEVENLABS_API_KEY },
    body: JSON.stringify({
      text, model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
    })
  })
  if (!res.ok) throw new Error(`ElevenLabs error: ${res.status}`)
  return await res.blob()
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Onboarding({ onComplete }: { onComplete: (p: Profile) => void }) {
  const [sectionIdx, setSectionIdx] = useState(0)
  const [profile, setProfile] = useState<Profile>({})
  const [sectionData, setSectionData] = useState<Record<string, Profile>>({})
  const [completed, setCompleted] = useState<string[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<string[]>([])
  const speakingRef = useRef(false)
  const initializedRef = useRef(false)

  const currentSection = SECTIONS[sectionIdx]
  const currentDraft = sectionData[currentSection.id] || {}
  const isLast = sectionIdx === SECTIONS.length - 1
  const progress = Math.round((completed.length / SECTIONS.length) * 100)

  const mergedProfile = useMemo(() => ({ ...profile, ...currentDraft }), [profile, currentDraft])
  const intro = typeof currentSection.intro === "function" ? currentSection.intro(mergedProfile) : currentSection.intro

  const stopCurrentAudio = useCallback(() => {
    const audio = audioRef.current; if (!audio) return
    audio.pause(); audio.currentTime = 0
    audio.onended = null; audio.onerror = null
  }, [])

  const playQueue = useCallback(async () => {
    if (speakingRef.current) return
    const nextText = queueRef.current.shift()
    if (!nextText) { setIsSpeaking(false); return }
    speakingRef.current = true; setIsSpeaking(true)
    try {
      const blob = await generateSpeech(nextText)
      const url = URL.createObjectURL(blob)
      let audio = audioRef.current
      if (!audio) { audio = new Audio(); audioRef.current = audio }
      audio.src = url
      await audio.play()
      await new Promise<void>(resolve => { audio!.onended = () => resolve(); audio!.onerror = () => resolve() })
      URL.revokeObjectURL(url)
    } catch(e) { console.error("Audio error:", e) }
    finally { speakingRef.current = false; playQueue() }
  }, [])

  const speakQueued = useCallback(async (text: string, interrupt = false) => {
    if (!audioEnabled || !text?.trim()) return
    if (interrupt) { queueRef.current = []; stopCurrentAudio(); speakingRef.current = false }
    queueRef.current.push(text)
    playQueue()
  }, [audioEnabled, playQueue, stopCurrentAudio])

  const enableAudio = useCallback(async () => {
    if (audioEnabled) return
    try {
      const testAudio = new Audio()
      testAudio.muted = true
      testAudio.src = "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA"
      await testAudio.play().catch(() => {})
      testAudio.pause()
      audioRef.current = testAudio
    } catch(_) {}
    finally { setAudioEnabled(true) }
  }, [audioEnabled])

  useEffect(() => { contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }) }, [sectionIdx])

  useEffect(() => {
    if (!audioEnabled) return
    if (!initializedRef.current) { initializedRef.current = true }
    speakQueued(intro, true)
  }, [sectionIdx, intro, audioEnabled, speakQueued])

  const updateField = (fieldId: string, value: string) => {
    setSectionData(prev => ({ ...prev, [currentSection.id]: { ...(prev[currentSection.id] || {}), [fieldId]: value } }))
  }

  const goToSection = async (idx: number) => { await enableAudio(); setSectionIdx(idx) }

  const handleNext = async () => {
    await enableAudio()
    const currentValues = sectionData[currentSection.id] || {}
    const newProfile = { ...profile, ...currentValues }
    setProfile(newProfile)
    if (!completed.includes(currentSection.id)) setCompleted(prev => [...prev, currentSection.id])
    if (!isLast) {
      const nextSection = SECTIONS[sectionIdx + 1]
      const nextIntro = typeof nextSection.intro === "function" ? nextSection.intro(newProfile) : nextSection.intro
      setSectionIdx(prev => prev + 1)
      speakQueued(`Entendido. Continuemos. ${nextIntro}`, true)
      return
    }
    speakQueued("Perfecto. Ya tengo toda la información. Activando mi modo completo.", true)
    setTimeout(() => { onComplete({ ...newProfile, completed: "true" }) }, 1800)
  }

  const handleSkip = async () => {
    await enableAudio()
    if (!completed.includes(currentSection.id)) setCompleted(prev => [...prev, currentSection.id])
    if (!isLast) {
      const nextSection = SECTIONS[sectionIdx + 1]
      const nextIntro = typeof nextSection.intro === "function" ? nextSection.intro(profile) : nextSection.intro
      setSectionIdx(prev => prev + 1)
      speakQueued(`Continuemos. ${nextIntro}`, true)
      return
    }
    onComplete({ ...profile, completed: "true" })
  }

  return (
    <div onPointerDown={enableAudio} style={{ display:"flex", width:"100%", height:"100%", minHeight:"100vh", background:"#05020f", color:"rgba(220,205,255,0.96)", fontFamily:"Inter, sans-serif", overflow:"hidden", position:"relative" }}>
      <Particles/>

      {/* SIDEBAR */}
      <aside style={{ width:260, flexShrink:0, display:"flex", flexDirection:"column", borderRight:"1px solid rgba(123,94,167,0.2)", background:"rgba(12,6,32,0.82)", padding:"24px 14px", gap:8, zIndex:2, overflow:"auto", backdropFilter:"blur(12px)" }}>
        <div style={{ fontFamily:"Franz, Orbitron, sans-serif", fontWeight:900, fontSize:20, letterSpacing:5, color:"#9b7fd4", textShadow:"0 0 15px rgba(155,127,212,0.5)", textAlign:"center", marginBottom:4 }}>ALAN AI</div>
        <div style={{ fontSize:9, color:"rgba(150,100,200,0.4)", letterSpacing:3, fontFamily:"Share Tech Mono, monospace", textAlign:"center", marginBottom:12 }}>PROTOCOLO DE ACTIVACIÓN</div>

        <div style={{ background:"rgba(123,94,167,0.08)", border:"1px solid rgba(123,94,167,0.18)", borderRadius:12, padding:14, marginBottom:12 }}>
          <div style={{ fontSize:11, color:"rgba(180,150,255,0.68)", marginBottom:8, letterSpacing:1 }}>PROGRESO</div>
          <div style={{ height:8, borderRadius:999, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:"linear-gradient(90deg, #9b7fd4, #6aaeff)", boxShadow:"0 0 18px rgba(106,174,255,0.35)", transition:"width 0.5s ease" }}/>
          </div>
          <div style={{ marginTop:8, fontSize:12, color:"rgba(220,205,255,0.88)" }}>{progress}% completado</div>
        </div>

        {SECTIONS.map((section, idx) => {
          const active = idx === sectionIdx
          const done = completed.includes(section.id)
          return (
            <button key={section.id} type="button" onClick={() => goToSection(idx)} style={{ textAlign:"left", padding:"12px", borderRadius:12, border: active ? `1px solid ${section.color}` : "1px solid rgba(123,94,167,0.12)", background: active ? "rgba(123,94,167,0.12)" : "rgba(255,255,255,0.02)", color:"inherit", minHeight:54, cursor:"pointer", transition:"all 0.2s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ color: done ? "#40ffb0" : section.color, fontSize:16, width:20 }}>{done ? "✓" : section.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, letterSpacing:1, color: done ? "#40ffb0" : active ? "rgba(210,185,255,0.9)" : "rgba(170,150,210,0.7)" }}>{section.title}</div>
                  <div style={{ fontSize:10, color:"rgba(170,150,210,0.5)", marginTop:2 }}>{done ? "✓ Completada" : active ? "● Actual" : "Pendiente"}</div>
                </div>
              </div>
            </button>
          )
        })}

        {mergedProfile.fullName && (
          <div style={{ marginTop:8, padding:"10px 12px", background:"rgba(20,8,50,0.4)", border:"1px solid rgba(123,94,167,0.12)", borderRadius:8 }}>
            <div style={{ fontSize:9, letterSpacing:2, color:"rgba(130,100,190,0.5)", fontFamily:"Share Tech Mono,monospace", marginBottom:6 }}>◈ PERFIL</div>
            <div style={{ fontSize:11, color:"rgba(200,180,255,0.8)", fontWeight:600 }}>{mergedProfile.fullName}</div>
            {mergedProfile.profession && <div style={{ fontSize:10, color:"rgba(130,100,180,0.5)", marginTop:2 }}>{mergedProfile.profession}</div>}
            {mergedProfile.currentLocation && <div style={{ fontSize:10, color:"rgba(130,100,180,0.5)" }}>{mergedProfile.currentLocation}</div>}
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main ref={contentRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"auto", zIndex:2 }}>
        <div style={{ padding:"24px 32px 16px", borderBottom:"1px solid rgba(123,94,167,0.12)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(123,94,167,0.15)", border:`1.5px solid ${currentSection.color}`, fontSize:18, color:currentSection.color }}>
                {currentSection.icon}
              </div>
              <div>
                <div style={{ fontFamily:"Orbitron, sans-serif", fontSize:13, fontWeight:700, color:currentSection.color, letterSpacing:3 }}>{currentSection.title}</div>
                <div style={{ fontSize:10, color:"rgba(150,120,200,0.5)", fontFamily:"Share Tech Mono, monospace", marginTop:2 }}>Sección {sectionIdx+1} de {SECTIONS.length}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color: isSpeaking ? currentSection.color : "rgba(180,150,255,0.45)", border:`1px solid ${isSpeaking ? currentSection.color : "rgba(123,94,167,0.18)"}`, borderRadius:999, padding:"8px 12px", background:"rgba(255,255,255,0.03)" }}>
              {isSpeaking ? "ALAN hablando..." : "ALAN en espera"}
            </div>
          </div>
          <div style={{ background:"rgba(123,94,167,0.08)", border:"1px solid rgba(123,94,167,0.18)", borderRadius:12, padding:"14px 16px", fontSize:14, color:"rgba(200,180,255,0.86)", lineHeight:1.7, borderLeft:`3px solid ${currentSection.color}` }}>
            {intro}
          </div>
        </div>

        <div style={{ flex:1, padding:"24px 32px", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:16, alignContent:"start" }}>
          {currentSection.fields.map(field => (
            <div key={field.id} style={{ gridColumn: field.type === "textarea" ? "1 / -1" : undefined }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:"rgba(180,150,255,0.72)", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>
                {field.label}
              </label>
              <FormField field={field} value={currentDraft[field.id] || ""} onChange={v => updateField(field.id, v)}/>
            </div>
          ))}
        </div>

        <div style={{ padding:"16px 32px 24px", borderTop:"1px solid rgba(123,94,167,0.1)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", flexShrink:0 }}>
          <button type="button" onClick={handleSkip} style={{ background:"transparent", border:"1px solid rgba(123,94,167,0.2)", color:"rgba(150,120,200,0.7)", padding:"11px 20px", borderRadius:10, fontSize:12, cursor:"pointer", fontFamily:"inherit", letterSpacing:1, minHeight:44 }}>
            Omitir sección
          </button>
          <button type="button" onClick={handleNext} style={{ background:"linear-gradient(135deg, rgba(123,94,167,0.26), rgba(77,143,255,0.20))", border:`1px solid ${currentSection.color}`, color:currentSection.color, padding:"12px 32px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Orbitron, sans-serif", letterSpacing:2, minHeight:46, boxShadow:`0 0 24px ${currentSection.color}22` }}>
            {isLast ? "ACTIVAR ALAN →" : "SIGUIENTE →"}
          </button>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(123,94,167,0.3); border-radius: 999px; }
        input::placeholder, textarea::placeholder { color: rgba(176,156,214,0.42); }
        input:focus, textarea:focus, select:focus {
          border-color: rgba(155,127,212,0.75) !important;
          box-shadow: 0 0 0 4px rgba(155,127,212,0.12), inset 0 1px 0 rgba(255,255,255,0.03) !important;
        }
        select option { background: #0c0620; color: rgba(215,195,255,0.95); }
        @media (max-width: 920px) { aside { display: none !important; } main { width: 100%; } }
      `}</style>
    </div>
  )
}
