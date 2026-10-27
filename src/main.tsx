import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import './index.css'
import { applyTheme, loadTheme } from './design/theme.ts'
import { registerServiceWorker } from './lib/install.ts'
import { announceRelease } from './lib/release.ts'

registerServiceWorker()
announceRelease()
applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
