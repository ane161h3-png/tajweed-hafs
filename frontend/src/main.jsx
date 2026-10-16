import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@fontsource/amiri-quran/400.css'
import './index.css'
import { SettingsProvider } from './features/settings/SettingsContext'
import { PlayerProvider } from './features/player/PlayerContext'
import App from './App'
import { registerServiceWorker } from './pwa'
import { setupNative } from './native'

registerServiceWorker()
setupNative()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <PlayerProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <App />
        </BrowserRouter>
      </PlayerProvider>
    </SettingsProvider>
  </StrictMode>,
)
