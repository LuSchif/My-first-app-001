import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '../index.ts'
import { Showcase } from './Showcase.tsx'
import '../../index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <Showcase />
    </TooltipProvider>
  </StrictMode>,
)
