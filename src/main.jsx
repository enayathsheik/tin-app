import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { DiwaliIntro } from './components/shared/DiwaliIntro.jsx'
import { hasTeamAccess } from './utils/teamAccess.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {hasTeamAccess() ? (
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    ) : <DiwaliIntro />}
  </StrictMode>,
)
