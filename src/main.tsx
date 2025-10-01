import React from 'react'
import ReactDOM from 'react-dom/client'
import GoGame from './components/go-game/GoGame'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoGame />
  </React.StrictMode>,
)
