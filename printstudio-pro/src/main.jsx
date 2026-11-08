import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './fabricEditor/kontroly'
import PrepinacJazyka from './i18n/PrepinacJazyka'
import ChatWidget from './ChatWidget'
import { spustiPreklad } from './i18n/prekladac'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <PrepinacJazyka />
    <ChatWidget />
  </React.StrictMode>,
)

spustiPreklad()
