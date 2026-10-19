import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { installResizeObserverGuard } from '@/lib/resizeObserverGuard'
import '@/index.css'

// Runs before any component mounts, so charts, dropdowns and report previews
// no longer raise the harmless ResizeObserver loop error.
installResizeObserverGuard()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)