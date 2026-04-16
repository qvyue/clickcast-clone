import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import WebsiteDetail from './components/WebsiteDetail'
import VideoEditor from './components/Editor/VideoEditor'

function App() {
  return (
    <Routes>
      {/* 编辑器页面独立，不使用 MainLayout */}
      <Route path="/editor/:domain" element={<VideoEditor />} />
      {/* 其他页面使用 MainLayout */}
      <Route path="/*" element={
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/websites" replace />} />
            <Route path="/websites" element={<WebsiteList />} />
            <Route path="/websites/:domain" element={<WebsiteDetail />} />
          </Routes>
        </MainLayout>
      } />
    </Routes>
  )
}

// Temporary placeholder - will be replaced by proper component
function WebsiteList() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📹</div>
      <h2>Select a website from the sidebar</h2>
      <p>Choose a website to view its pipeline details</p>
    </div>
  )
}

export default App
