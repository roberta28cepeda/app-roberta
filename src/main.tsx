import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { applyTheme, readCachedProfile } from './theme'

// Aplica as cores salvas neste aparelho antes de desenhar a tela, para não piscar a cor padrão.
applyTheme(readCachedProfile())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
