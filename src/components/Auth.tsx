import { useState } from "react"
import { supabase } from "../supabase"

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleAuth = async () => {
    if (!email || !password) return
    setLoading(true)
    setMessage("")
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage("Revisa tu email para confirmar tu cuenta.")
        setLoading(false)
        return
      }
      onLogin()
    } catch (e: any) {
      setMessage(e.message || "Error de autenticación.")
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      width:"100%", height:"100%",
      background:"rgba(6,8,14,0.97)", fontFamily:"Inter, sans-serif"
    }}>
      <div style={{
        width:360, background:"rgba(0,210,255,0.04)",
        border:"1px solid rgba(0,210,255,0.15)", borderRadius:16,
        padding:"40px 32px", display:"flex", flexDirection:"column", gap:16
      }}>
        <div style={{textAlign:"center", marginBottom:8}}>
          <div style={{fontFamily:"Orbitron, sans-serif", fontSize:22, fontWeight:900, color:"#00d2ff", letterSpacing:4}}>ALAN AI</div>
          <div style={{fontSize:11, color:"rgba(0,210,255,0.4)", letterSpacing:2, marginTop:4}}>
            {isLogin ? "INICIAR SESIÓN" : "CREAR CUENTA"}
          </div>
        </div>

        <input
          type="email" placeholder="Email"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,210,255,0.2)", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:13, outline:"none", fontFamily:"Inter, sans-serif"}}
        />
        <input
          type="password" placeholder="Contraseña"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAuth()}
          style={{background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,210,255,0.2)", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:13, outline:"none", fontFamily:"Inter, sans-serif"}}
        />

        {message && <div style={{fontSize:11, color:"#fbbf24", textAlign:"center"}}>{message}</div>}

        <button onClick={handleAuth} disabled={loading} style={{
          background:"rgba(0,210,255,0.1)", border:"1px solid rgba(0,210,255,0.4)",
          color:"#00d2ff", borderRadius:8, padding:"11px", fontSize:12,
          fontFamily:"Share Tech Mono, monospace", letterSpacing:2, cursor:"pointer",
          transition:"all .2s"
        }}>
          {loading ? "..." : isLogin ? "ENTRAR" : "REGISTRARSE"}
        </button>

        <button onClick={handleGoogle} style={{
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
          color:"rgba(255,255,255,0.7)", borderRadius:8, padding:"11px", fontSize:12,
          fontFamily:"Inter, sans-serif", cursor:"pointer", transition:"all .2s"
        }}>
          Continuar con Google
        </button>

        <div style={{textAlign:"center", fontSize:11, color:"rgba(0,210,255,0.4)", cursor:"pointer"}}
          onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </div>
      </div>
    </div>
  )
}
