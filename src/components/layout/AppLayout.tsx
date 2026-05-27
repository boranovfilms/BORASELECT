import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Library, Users, Package, LayoutTemplate, CreditCard, Settings, Shield, HelpCircle, LogOut, Bell, X, Loader2, Image as ImageControl, Trash2, Save, CheckSquare, UsersRound, FileText, Database
} from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { settingsService, GlobalSettings } from '@/src/services/settingsService';
import { useProjectStore } from '@/src/store/useProjectStore';
import { PermissionsMatrix } from '@/src/services/permissionsService';

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: string;
  permissions?: PermissionsMatrix;
}

export default function AppLayout({ children, userRole = 'cliente', permissions = {} }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;
  const { currentProjectName, currentProjectEmail } = useProjectStore();
  const [showGlobalSettings, setShowGlobalSettings] = React.useState(false);
  const [globalSettings, setGlobalSettings] = React.useState<GlobalSettings | null>(null);
  const [uploadingWatermark, setUploadingWatermark] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  React.useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const s = await settingsService.getSettings();
    setGlobalSettings(s);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const ALL_MODULES = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { id: 'projetos', icon: Library, label: 'Projeto Seleção', path: '/projetos' },
    { id: 'planejamentos', icon: FileText, label: 'Planejamentos', path: '/meus-planejamentos' },
    { id: 'clientes', icon: Users, label: 'Clientes', path: '/clients' },
    { id: 'equipe', icon: UsersRound, label: 'Equipe', path: '/equipe' },
    { id: 'pacotes', icon: Package, label: 'Serviços', path: '/packages' },
    { id: 'modelos', icon: LayoutTemplate, label: 'Modelos', path: '/modelos' },
    { id: 'creditos', icon: CreditCard, label: 'Créditos', path: '/credits' },
    { id: 'tarefas', icon: CheckSquare, label: 'Tarefas Diárias', path: '/tarefas' },
    { id: 'painel_master', icon: Shield, label: 'Painel Master', path: '/painel-master' },
    { id: 'diagnostico', icon: Database, label: 'Teste Tabela', path: '/diagnostico' }
  ];

  const navItems = ALL_MODULES.filter(mod => {
    if (mod.id === 'planejamentos' && userRole === 'cliente') return true;
    if (mod.id === 'painel_master' && userRole === 'master') return true;
    if (mod.id === 'diagnostico' && userRole === 'master') return true;
    return permissions[mod.id]?.[userRole] === true;
  });

  if (navItems.length === 0) {
    navItems.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' });
  }

  return (
    <div className="min-h-screen bg-[#131313] text-[#e2e2e2] font-sans selection:bg-[#ff5351]/30 selection:text-white">
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-xl border-b border-zinc-800 z-[200] flex items-center justify-between px-6">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ff5351] animate-pulse" />
            <span className="text-xl font-black tracking-tighter uppercase text-white">BORA SELECT</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-zinc-400 hover:text-white transition-colors"><Bell className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex pt-16">
        <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-16 bottom-0 bg-[#0e0e0e] border-r border-zinc-800 p-4">
          <div className="mb-8 px-2 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800">
              {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500"><Users className="w-6 h-6" /></div>}
            </div>
            <div>
              <div className="text-sm font-bold text-white truncate max-w-[140px]">{user?.displayName || 'Bora Select'}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-black italic">Role: {userRole}</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.id} to={item.path} className={({ isActive }) => cn('flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium', isActive ? 'bg-zinc-800/50 text-[#ff5351] border-l-2 border-[#ff5351]' : 'text-zinc-400 hover:text-white hover:bg-zinc-800')}>
                <item.icon className="w-4 h-4" />{item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-zinc-800 space-y-1">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-[#ff5351] transition-all text-sm font-medium"><LogOut className="w-4 h-4" />Logout</button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
