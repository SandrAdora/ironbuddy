import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import  OnboardingForm  from './App.jsx'
import { UserProvider } from './context/userContext.jsx'; 
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <OnboardingForm />
    </UserProvider>
  </StrictMode>,
)
