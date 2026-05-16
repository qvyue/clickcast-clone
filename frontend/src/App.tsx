import { Routes, Route, Navigate } from 'react-router-dom'
import VideoEditor from './components/Editor/VideoEditor'

function App() {
  return (
    <Routes>
      {/* 编辑器页面 */}
      <Route path="/editor/:domain" element={<VideoEditor />} />
      {/* 其他路由重定向到首页（由 server.js 渲染） */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
