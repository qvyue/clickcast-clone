import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const VideoEditor = lazy(() => import('./components/Editor/VideoEditor'))
const TermsPage = lazy(() => import('./components/Terms').then(m => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('./components/Privacy').then(m => ({ default: m.PrivacyPage })))
const AuthCallback = lazy(() => import('./components/LoginModal').then(m => ({ default: m.AuthCallback })))
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })))
const BlogPage = lazy(() => import('./pages/Blog').then(m => ({ default: m.BlogPage })))
const BlogPostPage = lazy(() => import('./pages/BlogPost').then(m => ({ default: m.BlogPostPage })))

function App() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8b949e', fontFamily: 'system-ui' }}>Loading...</div>}>
      <Routes>
        {/* 首页 */}
        <Route path="/" element={<Home />} />
        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* 编辑器页面 */}
        <Route path="/editor/:domain" element={<VideoEditor />} />
        {/* OAuth callback */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Terms of Service */}
        <Route path="/terms" element={<TermsPage />} />
        {/* Privacy Policy */}
        <Route path="/privacy" element={<PrivacyPage />} />
        {/* Admin Panel */}
        <Route path="/admin" element={<Admin />} />
        {/* Blog */}
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        {/* 其他路由重定向到首页（由 server.js 渲染） */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
