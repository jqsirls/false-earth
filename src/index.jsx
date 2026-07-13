import './style.css'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { maybeRenderHueCallbackLanding } from './lib/hueCallbackLanding'
import { MEADOW_BOOTSTRAP_ERROR } from './core/utils/gpuError'

function showBootstrapError() {
  const root = document.querySelector('#root')
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0a;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;">
      <div style="max-width:420px;">
        <p style="margin:0 0 8px;font-size:0.75rem;letter-spacing:0.12em;opacity:0.7;">BOOSTER'S MEADOW</p>
        <p style="margin:0 0 12px;font-weight:600;">${MEADOW_BOOTSTRAP_ERROR.headline}</p>
        <p style="margin:0;font-size:0.85rem;line-height:1.5;opacity:0.8;">${MEADOW_BOOTSTRAP_ERROR.body}</p>
      </div>
    </div>
  `
}

// Hue OAuth popup landing: relay params to the opener and close — never boot
// the 3D scene in the popup. App is imported dynamically so its module-level
// asset preloads don't run for this window.
if (!maybeRenderHueCallbackLanding()) {
  import('./app/App')
    .then(({ default: App }) => {
      createRoot(document.querySelector('#root')).render(<StrictMode><App /></StrictMode>)
    })
    .catch((error) => {
      console.error('[false-earth] bootstrap failed:', error)
      showBootstrapError()
    })
}

window.addEventListener('error', (event) => {
  const root = document.querySelector('#root')
  if (root && !root.innerHTML.trim()) {
    console.error('[false-earth] uncaught error before mount:', event.error ?? event.message)
    showBootstrapError()
  }
})
