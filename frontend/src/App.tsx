import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'
import VideoEditor from './components/Editor/VideoEditor'
import { TermsPage } from './components/Terms'
import { PrivacyPage } from './components/Privacy'
import { AuthCallback } from './components/LoginModal'
import { useAuthStore } from './store/authStore'

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return () => unsubscribe()
  }, [initialize])

  return (
    <Routes>
      {/* 首页 */}
      <Route path="/" element={<Home />} />
      {/* 编辑器页面 */}
      <Route path="/editor/:domain" element={<VideoEditor />} />
      {/* OAuth callback */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* Terms of Service */}
      <Route path="/terms" element={<TermsPage />} />
      {/* Privacy Policy */}
      <Route path="/privacy" element={<PrivacyPage />} />
      {/* 其他路由重定向到首页（由 server.js 渲染） */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
