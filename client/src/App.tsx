import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Kiosk } from './pages/Kiosk'
import { StudentLanding } from './pages/StudentLanding'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Kiosk />} />
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/student" element={<StudentLanding />} />
      <Route path="*" element={<Navigate to="/kiosk" replace />} />
    </Routes>
  )
}

export default App
