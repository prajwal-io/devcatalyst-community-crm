import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { AuthLayout } from '../components/AuthLayout'

export function RegisterPage() {
  const { user, profile, loading, signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && profile) {
    return <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/app'} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      const result = await signUp(fullName.trim(), email, password)
      if (result.needsEmailConfirmation) {
        setMessage('Account created. Check your email to confirm your account, then sign in.')
      } else {
        navigate('/', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">There’s a place for you here</p>
        <h1>Join the community.</h1>
        <p>Discover events, meet fellow builders, and keep track of every experience.</p>

        <label>
          Full name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>

        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        </label>

        <label>
          Confirm password
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
        </label>

        {error && <p role="alert" className="error">{error}</p>}
        {message && <p role="status" className="success">{message}</p>}

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create participant account'}
        </button>

        <p>Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  )
}
