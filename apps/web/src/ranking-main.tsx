import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/ui.css'
import './i18n'
import './ranking.css'
import { AccountProvider } from './providers/AccountProvider'
import { RankingApp } from './RankingApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <RankingApp />
    </AccountProvider>
  </StrictMode>,
)
