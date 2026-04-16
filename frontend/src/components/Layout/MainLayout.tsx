import { ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app-layout">
      <Header />
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  )
}
