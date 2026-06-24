// @ts-nocheck
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { insforge } from './lib/insforge';
import Login from './pages/Login';
import POS from './pages/POS';
import History from './pages/History';
import Shift from './pages/Shift';
import AppLayout from './components/layout/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insforge.auth.getCurrentUser().then(({ data: { user } }) => {
      setSession(user);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<POS />} />
          <Route path="history" element={<History />} />
          <Route path="shift" element={<Shift />} />
          <Route path="settings" element={
            <div className="p-4">
              <button 
                onClick={() => insforge.auth.signOut()}
                className="rounded bg-red-500 px-4 py-2 text-white font-bold"
              >
                Logout
              </button>
            </div>
          } />
        </Route>
      </Routes>
    </Router>
  );
}
