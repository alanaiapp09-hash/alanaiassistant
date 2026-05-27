import { useState, useEffect } from "react"
import Onboarding, { saveProfile, loadProfile } from "./components/Onboarding"
import Chat from "./components/Chat"
import "./App.css"

type Profile = Record<string, string>

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Intentar Electron primero
        if ((window as any).alan?.loadProfile) {
          const saved = await (window as any).alan.loadProfile()
          if (saved?.completed) { setProfile(saved); setLoading(false); return }
        }
        // Fallback localStorage
        const saved = loadProfile()
        if (saved?.completed) { setProfile(saved); setLoading(false); return }
      } catch(_) {
        // Si falla Electron, usar localStorage
        const saved = loadProfile()
        if (saved?.completed) { setProfile(saved); setLoading(false); return }
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleComplete = async (newProfile: Profile) => {
    // Guardar siempre en localStorage primero
    saveProfile(newProfile)
    // Intentar guardar en Electron también
    try {
      if ((window as any).alan?.saveProfile) {
        await (window as any).alan.saveProfile(newProfile)
      }
    } catch(_) {}
    setProfile(newProfile)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-orb"></div>
      <p>Iniciando ALAN AI...</p>
    </div>
  )

  return (
    <div className="app-root">
      {!profile ? <Onboarding onComplete={handleComplete}/> : <Chat profile={profile}/>}
    </div>
  )
}