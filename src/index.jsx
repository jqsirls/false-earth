import './style.css'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { StrictMode } from 'react'
import { preloadVATAssets } from './components/Rose/core'

preloadVATAssets('/vat/Rose_meta.json');
createRoot(document.querySelector('#root')).render(<StrictMode><App /></StrictMode>)