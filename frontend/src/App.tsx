import { Routes, Route, Navigate } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import Dashboard from './pages/Dashboard'
import CompareDashboard from './pages/CompareDashboard'
import { useAnalysisStore } from './store/analysisStore'

function App() {
  const result = useAnalysisStore((s) => s.result)
  const compareResult = useAnalysisStore((s) => s.compareResult)
  return (
    <div className="min-h-screen w-full">
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route
          path="/dashboard"
          element={result ? <Dashboard /> : <Navigate to="/" replace />}
        />
        <Route
          path="/compare"
          element={compareResult ? <CompareDashboard /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
