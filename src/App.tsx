import { useState, useEffect } from "react"
import Onboarding, { saveProfile, loadProfile } from "./components/Onboarding"
import Chat from "./components/Chat"
import "./App.css"

type Profile = Record<string, string>

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const api = (window as any).alan
    if (!api?.onDeepLink) return

    api.onDeepLink((url: string) => {
      console.log('Deep link recibido:', url)
      // TODO: manejar alan://gmail y alan://auth en siguiente sprint
    })
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        if ((window as any).alan?.loadProfile) {
          const saved = await (window as any).alan.loadProfile()
          if (saved?.completed) { setProfile(saved); setLoading(false); return }
        }
        const saved = loadProfile()
        if (saved?.completed) { setProfile(saved); setLoading(false); return }
      } catch(_) {
        const saved = loadProfile()
        if (saved?.completed) { setProfile(saved); setLoading(false); return }
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleComplete = async (newProfile: Profile) => {
    saveProfile(newProfile)
    try {
      if ((window as any).alan?.saveProfile) {
        await (window as any).alan.saveProfile(newProfile)
      }
    } catch(_) {}
    setProfile(newProfile)
    setEditing(false)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-orb"></div>
      <p>Iniciando ALAN AI...</p>
    </div>
  )

  if (!profile || editing) return (
    <Onboarding onComplete={handleComplete} initialProfile={editing ? profile || undefined : undefined}/>
  )

  return (
    <div className="app-root">
      <Chat profile={profile} onEditProfile={() => setEditing(true)}/>
    </div>
  )
}
