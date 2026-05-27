import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { auth, db } from './lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { permissionsService, PermissionsMatrix } from './services/permissionsService';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Projetos from './pages/Projetos'; 
import Login from './pages/Login';
import Register from './pages/Register';
import ProjectConfig from './pages/ProjectConfig';
import ProjectReview from './pages/ProjectReview';
import ProjectDownload from './pages/ProjectDownload';
import ClientAccess from './pages/ClientAccess';
import ClientDetails from './pages/ClientDetails'; 
import NewContentPlan from './pages/NewContentPlan'; 
import ContentPlanDetails from './pages/ContentPlanDetails';
import Packages from './pages/Packages';
import Credits from './pages/Credits';
import ModelosFluxo from './pages/ModelosFluxo'; 
import ModelosEdicao from './pages/ModelosEdicao';
import ProjetoFluxo from './pages/ProjetoFluxo';
import PainelMaster from './pages/PainelMaster';
import Tarefas from './pages/Tarefas';
import EquipeAccess from './pages/Equipe';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('cliente');
  const [permissions, setPermissions] = useState<PermissionsMatrix>({});

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const cleanEmail = currentUser.email?.toLowerCase().trim();
          const q = query(collection(db, 'clients'), where('email', '==', cleanEmail));
          const snapshot = await getDocs(q);
          
          let role = 'cliente';
          
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            // Normaliza a role vinda do banco (remove acentos e espaços para bater com a Matriz)
            const rawRole = data.role || 'cliente';
            role = rawRole.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
              .replace(/\s+/g, '_'); // Troca espaços por underscore
          } else if (cleanEmail === 'boranovfilms@gmail.com') {
            role = 'master';
          }
          
          setUserRole(role);
          const matrix = await permissionsService.getPermissions();
          setPermissions(matrix || {});

        } catch (error) {
          console.error("Erro ao carregar permissões", error);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff5351] border-t-transparent animate-spin" />
      </div>
    );
  }

  const wrapLayout = (element: React.ReactNode) => (
    <AppLayout userRole={userRole} permissions={permissions}>
      {element}
    </AppLayout>
  );

  const internalRoles = ['master', 'admin', 'editor_de_video', 'designer', 'redator', 'midia_social'];
  const isAdmin = user?.email === 'boranovfilms@gmail.com' || internalRoles.includes(userRole);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        
        <Route path="/" element={user ? wrapLayout(<Dashboard />) : <Navigate to="/login" />} />
        <Route path="/projetos" element={user ? wrapLayout(<Projetos />) : <Navigate to="/login" />} />
        <Route path="/review/:id" element={user ? wrapLayout(<ProjectReview />) : <Navigate to="/login" />} />
        <Route path="/download/:id" element={user ? wrapLayout(<ProjectDownload />) : <Navigate to="/login" />} />
        
        <Route path="/projects/:id/config" element={user && isAdmin ? wrapLayout(<ProjectConfig />) : <Navigate to="/" />} />
        <Route path="/clients" element={user && isAdmin ? wrapLayout(<ClientAccess />) : <Navigate to="/" />} />
        <Route path="/clients/:id" element={user && isAdmin ? wrapLayout(<ClientDetails />) : <Navigate to="/" />} />
        <Route path="/clients/:id/novo-planejamento" element={user && isAdmin ? wrapLayout(<NewContentPlan />) : <Navigate to="/" />} />
        
        <Route path="/planejamento/:id" element={user ? wrapLayout(<ContentPlanDetails />) : <Navigate to="/login" />} />
        <Route path="/packages" element={user && isAdmin ? wrapLayout(<Packages />) : <Navigate to="/" />} />
        <Route path="/credits" element={user && isAdmin ? wrapLayout(<Credits />) : <Navigate to="/" />} />
        <Route path="/modelos" element={user && isAdmin ? wrapLayout(<ModelosFluxo />) : <Navigate to="/" />} />
        <Route path="/modelos/:id" element={user && isAdmin ? wrapLayout(<ModelosEdicao />) : <Navigate to="/" />} />
        <Route path="/projetos/:id/fluxo" element={user && isAdmin ? wrapLayout(<ProjetoFluxo />) : <Navigate to="/" />} />
        <Route path="/equipe" element={user ? wrapLayout(<EquipeAccess />) : <Navigate to="/login" />} />
        <Route path="/painel-master" element={user ? wrapLayout(<PainelMaster />) : <Navigate to="/login" />} />
        <Route path="/tarefas" element={user ? wrapLayout(<Tarefas />) : <Navigate to="/login" />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
