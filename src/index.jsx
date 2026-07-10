import './style.css'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { StrictMode } from 'react'

function showBootstrapError(message) {
  const root = document.querySelector('#root')
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0a;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;">
      <div style="max-width:420px;">
        <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.12em;opacity:0.7;">BOOSTER'S MEADOW</p>
        <p style="margin:0 0 12px;font-weight:600;">Something went wrong loading the experience.</p>
        <p style="margin:0;font-size:0.85rem;line-height:1.5;opacity:0.8;">${message}</p>
      </div>
    </div>
  `
}

try {
  createRoot(document.querySelector('#root')).render(<StrictMode><App /></StrictMode>)
} catch (error) {
  console.error('[false-earth] bootstrap failed:', error)
  showBootstrapError(error instanceof Error ? error.message : 'Unknown startup error')
}

window.addEventListener('error', (event) => {
  const root = document.querySelector('#root')
  if (root && !root.innerHTML.trim()) {
    console.error('[false-earth] uncaught error before mount:', event.error ?? event.message)
    showBootstrapError(event.error?.message ?? event.message ?? 'Unknown error')
  }
})