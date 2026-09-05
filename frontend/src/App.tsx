import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { AdminHomePage } from './pages/AdminHomePage'
import { LoginPage } from './pages/LoginPage'
import { ParticipantHomePage } from './pages/ParticipantHomePage'
import { RegisterPage } from './pages/RegisterPage'

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <main className="centered"><p>Loading...</p></main>
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/app'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute role="PARTICIPANT">
            <ParticipantHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminHomePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
