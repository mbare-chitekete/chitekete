
import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './AuthGate'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found. Check index.html.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
)
