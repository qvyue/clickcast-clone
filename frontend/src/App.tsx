import { Routes, Route, Navigate } from 'react-router-dom'
import VideoEditor from './components/Editor/VideoEditor'
import { TermsPage } from './components/Terms'
import { PrivacyPage } from './components/Privacy'

function App() {
  return (
    <Routes>
      {/* 编辑器页面 */}
      <Route path="/editor/:domain" element={<VideoEditor />} />
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
