import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from '@/presentation/context/ThemeContext.jsx'
import { RealtimeProvider } from '@/presentation/context/RealtimeContext.jsx'
import 'mapbox-gl/dist/mapbox-gl.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <RealtimeProvider>
        <App />
      </RealtimeProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
