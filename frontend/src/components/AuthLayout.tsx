import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'

export function AuthLayout({ children }: PropsWithChildren) {
  return <main className="auth-page">
    <section className="auth-story" aria-label="Welcome to DevCatalyst">
      <Link to="/login" className="story-brand"><img src="/devcatalyst-logo.png" width="100" height="100" alt="DevCatalyst" /><span>THE COMMUNITY SPACE</span></Link>
      <div className="story-content">
        <p className="eyebrow">Curiosity brings us together.</p>
        <h1>Good people. <br />Great ideas. <br /><em>What’s next?</em></h1>
        <p>A place to connect, show up, and build something meaningful. Your next community experience starts here.</p>
        <div className="community-art" aria-hidden="true"><span className="art-ring" /><span className="art-ring second" /><span className="art-core">dc.</span><span className="art-label">CONNECT · LEARN · BUILD</span></div>
      </div>
      <p className="story-footer">DevCatalyst <span>Built around belonging.</span></p>
    </section>
    <section className="auth-form-panel" aria-label="Your account">{children}<p className="auth-footnote">Your community. Your next chapter.</p></section>
  </main>
}
