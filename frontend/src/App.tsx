import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { AdminEventFormPage } from './pages/AdminEventFormPage'
import { AdminEventRegistrationsPage } from './pages/AdminEventRegistrationsPage'
import { AdminHomePage } from './pages/AdminHomePage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminParticipantsPage } from './pages/AdminParticipantsPage'
import { AdminParticipantHistoryPage } from './pages/AdminParticipantHistoryPage'
import { EventDetailsPage } from './pages/EventDetailsPage'
import { LoginPage } from './pages/LoginPage'
import { MyRegistrationsPage } from './pages/MyRegistrationsPage'
import { ParticipantHomePage } from './pages/ParticipantHomePage'
import { RegisterPage } from './pages/RegisterPage'

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <main className="centered"><p>Loading...</p></main>
  if (!user || !profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/app'} replace />
}

function ParticipantOnly({ children }: { children: ReactNode }) {
  return <ProtectedRoute role="PARTICIPANT">{children}</ProtectedRoute>
}

function AdminOnly({ children }: { children: ReactNode }) {
  return <ProtectedRoute role="ADMIN">{children}</ProtectedRoute>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/app" element={<ParticipantOnly><ParticipantHomePage /></ParticipantOnly>} />
      <Route path="/app/events/:eventId" element={<ParticipantOnly><EventDetailsPage /></ParticipantOnly>} />
      <Route path="/app/registrations" element={<ParticipantOnly><MyRegistrationsPage /></ParticipantOnly>} />

      <Route path="/admin" element={<AdminOnly><AdminHomePage /></AdminOnly>} />
      <Route path="/admin/dashboard" element={<AdminOnly><AdminDashboardPage /></AdminOnly>} />
      <Route path="/admin/participants" element={<AdminOnly><AdminParticipantsPage /></AdminOnly>} />
      <Route path="/admin/events/new" element={<AdminOnly><AdminEventFormPage /></AdminOnly>} />
      <Route path="/admin/events/:eventId/edit" element={<AdminOnly><AdminEventFormPage /></AdminOnly>} />
      <Route path="/admin/events/:eventId/registrations" element={<AdminOnly><AdminEventRegistrationsPage /></AdminOnly>} />
      <Route path="/admin/participants/:participantId/history" element={<AdminOnly><AdminParticipantHistoryPage /></AdminOnly>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
