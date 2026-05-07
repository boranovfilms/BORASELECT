import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { auth } from './lib/firebase';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import ProjectConfig from './pages/ProjectConfig';
import ProjectReview from './pages/ProjectReview';
import ClientAccess from './pages/ClientAccess';
import VideoTest from './pages/VideoTest';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
      
      // Update last access for clients
      if (u && u.email && u.email !== 'boranovfilms@gmail.com') {
        import('./services/clientService').then(({ clientService }) => {
          clientService.updateLastAccess(u.email!).catch(err => {
            console.warn('Silent failure updating last access:', err);
          });
        });
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff5351] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.email === 'boranovfilms@gmail.com';

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        
        <Route path="/" element={user ? <AppLayout><Dashboard /></AppLayout> : <Navigate to="/login" />} />
        <Route path="/projects/:id/config" element={user && isAdmin ? <AppLayout><ProjectConfig /></AppLayout> : <Navigate to="/" />} />
        <Route path="/clients" element={user && isAdmin ? <AppLayout><ClientAccess /></AppLayout> : <Navigate to="/" />} />
        <Route path="/video-test" element={user && isAdmin ? <AppLayout><VideoTest /></AppLayout> : <Navigate to="/" />} />
        
        {/* Public Route for Clients - Now using same layout for consistency */}
        <Route path="/review/:id" element={user ? <AppLayout><ProjectReview /></AppLayout> : <Navigate to="/login" />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
