import { Routes, Route, Navigate } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import Dashboard from './pages/Dashboard'
import { useAnalysisStore } from './store/analysisStore'

function App() {
  const result = useAnalysisStore((s) => s.result)
  return (
    <div className="min-h-screen w-full">
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route
          path="/dashboard"
          element={result ? <Dashboard /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
