import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initStore } from './data/store'
import './styles.css'

void initStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
