import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from '@/presentation/context/ThemeContext.jsx'
import { AntdProvider } from '@/presentation/theme/AntdProvider.jsx'
import { hydrateAuthStores, getAuthToken, notifyAuthReady } from '@/core/auth/session'
import 'leaflet/dist/leaflet.css'
import './index.css'

hydrateAuthStores()
if (getAuthToken()) {
  notifyAuthReady()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AntdProvider>
        <App />
      </AntdProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
