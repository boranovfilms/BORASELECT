import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Library, Users, Package, LayoutTemplate, CreditCard, Settings, Shield, HelpCircle, LogOut, Bell, X, Loader2, Image as ImageControl, Trash2, Save, CheckSquare, UsersRound, FileText, Database
} from 'lucide-react';
import { auth, db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { cn } from '@/src/lib/utils';
import { settingsService, GlobalSettings } from '@/src/services/settingsService';
import { useProjectStore } from '@/src/store/useProjectStore';
import { PermissionsMatrix } from '@/src/services/permissionsService';
import { taskService, Task } from '@/src/services/taskService';

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
  
  // Estados de Notificação Global
  const [pendingNotifications, setPendingNotifications] = React.useState<Task[]>([]);
  const audioContext = React.useRef<AudioContext | null>(null);

  React.useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const s = await settingsService.getSettings();
    setGlobalSettings(s);
  };

  const playNotificationSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContext.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        o.start(ctx.currentTime + i * 0.15);
        o.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch (e) {
      console.warn('Som de notificação bloqueado');
    }
  };

  // Monitoramento Global de Tarefas Delegadas
  React.useEffect(() => {
    if (!user?.email) return;
    const userEmail = user.email.toLowerCase().trim();

    const q = query(
      collection(db, 'tasks'),
      where('delegadoPara', '==', userEmail),
      where('vistoPeloDelegado', '==', false),
      where('status', '==', 'pendente')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setPendingNotifications(newTasks);

      if (newTasks.length > 0) {
        const sessionKey = `global_notified_${userEmail}`;
        const notifiedIds = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
        let shouldPlay = false;

        newTasks.forEach(t => {
          if (!notifiedIds.includes(t.id)) {
            shouldPlay = true;
            notifiedIds.push(t.id);
          }
        });

        if (shouldPlay) {
          playNotificationSound();
          sessionStorage.setItem(sessionKey, JSON.stringify(notifiedIds));
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleClearNotifications = async () => {
    if (pendingNotifications.length > 0) {
      await Promise.all(pendingNotifications.map(t => taskService.markAsSeen(t.id!)));
    }
    navigate('/tarefas');
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
          <button 
            onClick={handleClearNotifications}
            className="relative p-2 text-zinc-400 hover:text-white transition-all group"
          >
            <Bell className={cn(
              "w-6 h-6 transition-all", 
              pendingNotifications.length > 0 && "text-[#ff5351] animate-[bell_2s_infinite_ease-in-out]"
            )} />
            
            {pendingNotifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#ff5351] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-black animate-in zoom-in duration-300">
                {pendingNotifications.length}
              </span>
            )}
            
            <style>{`
              @keyframes bell {
                0%, 100% { transform: rotate(0deg); }
                10%, 30%, 50% { transform: rotate(15deg); }
                20%, 40%, 60% { transform: rotate(-15deg); }
                70%, 80%, 90% { transform: rotate(0deg); }
              }
            `}</style>
          </button>
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
