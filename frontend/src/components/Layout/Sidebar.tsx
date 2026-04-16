import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchWebsites } from '../../api/client'
import type { Website } from '../../types'

export default function Sidebar() {
  const navigate = useNavigate()
  const { domain } = useParams()
  const { data: websites, isLoading } = useQuery({
    queryKey: ['websites'],
    queryFn: fetchWebsites,
  })

  const handleSelect = (website: Website) => {
    navigate(`/websites/${website.domain}`)
  }

  const handleEdit = (e: React.MouseEvent, websiteDomain: string) => {
    e.stopPropagation()
    navigate(`/editor/${websiteDomain}`)
  }

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">Websites</h2>
      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : websites && websites.length > 0 ? (
        <ul className="website-list">
          {websites.map((website) => (
            <li
              key={website.domain}
              className={`website-item ${domain === website.domain ? 'active' : ''}`}
              onClick={() => handleSelect(website)}
            >
              <span
                className={`website-status ${
                  website.status === 'processing'
                    ? 'processing'
                    : website.status === 'failed'
                    ? 'failed'
                    : ''
                }`}
              />
              <span className="website-name">{website.domain}</span>
              {(website.hasLandscape || website.hasPortrait) && (
                <button
                  className="edit-btn"
                  onClick={(e) => handleEdit(e, website.domain)}
                  title="Edit in Video Editor"
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <p style={{ fontSize: '0.85rem' }}>No websites yet</p>
        </div>
      )}
    </aside>
  )
}
