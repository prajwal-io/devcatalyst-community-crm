import { useAuth } from '../context/AuthContext'

export function ParticipantHomePage() {
  const { profile, signOut } = useAuth()

  return (
    <main className="workspace">
      <section className="workspace-card">
        <p className="eyebrow">Participant workspace</p>
        <h1>Phase 1 authentication is working.</h1>
        <p>Signed in as {profile?.full_name} ({profile?.email}).</p>
        <p>Event discovery and registration are intentionally coming in later phases.</p>
        <button onClick={() => void signOut()}>Sign out</button>
      </section>
    </main>
  )
}
