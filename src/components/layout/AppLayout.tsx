import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Library, Users, Package, LayoutTemplate, CreditCard, Settings, Shield, HelpCircle, LogOut, Bell, X, Loader2, Image as ImageControl, Trash2, Save, CheckSquare, UsersRound, FileText, Database, ChevronRight, ArrowRight, Tv
} from 'lucide-react';
import { auth, db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { cn } from '@/src/lib/utils';
import { settingsService, GlobalSettings } from '@/src/services/settingsService';
import { useProjectStore } from '@/src/store/useProjectStore';
import { PermissionsMatrix } from '@/src/services/permissionsService';
import { taskService, Task } from '@/src/services/taskService';
import { notificacaoService, Notificacao } from '@/src/services/notificacaoService';

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: string;
  userName?: string;
  permissions?: PermissionsMatrix;
}

export default function AppLayout({ children, userRole = 'cliente', userName = '', permissions = {} }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;
  const { currentProjectName, currentProjectEmail } = useProjectStore();
  const [showGlobalSettings, setShowGlobalSettings] = React.useState(false);
  const [globalSettings, setGlobalSettings] = React.useState<GlobalSettings | null>(null);
  const [uploadingWatermark, setUploadingWatermark] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  
  const [pendingNotifications, setPendingNotifications] = React.useState<Notificacao[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = React.useState(false);
  const audioContext = React.useRef<AudioContext | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const effectiveName = userName || user?.displayName || 'Usuário';
  const firstName = effectiveName.split(' ')[0].toUpperCase();
  const initials = effectiveName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'BS';

  React.useEffect(() => {
    loadSettings();
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  React.useEffect(() => {
    if (!user?.email) return;
    const userEmail = user.email.toLowerCase().trim();

    const unsubscribe = notificacaoService.escutar(userEmail, (notifs) => {
      setPendingNotifications(notifs);

      if (notifs.length > 0) {
        const sessionKey = `global_notified_${userEmail}`;
        const notifiedIds = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
        let shouldPlay = false;

        notifs.forEach(n => {
          if (!notifiedIds.includes(n.id)) {
            shouldPlay = true;
            notifiedIds.push(n.id);
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

  const handleNotificationClick = async (notif: Notificacao) => {
    try {
      await notificacaoService.marcarComoVisto(notif.id!);
    } catch(e) {}
    setShowNotificationDropdown(false);
    if (notif.planId) {
      navigate(`/planejamento/${notif.planId}`);
    } else {
      navigate('/tarefas');
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const ALL_MODULES = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { id: 'projetos', icon: Library, label: 'Projetos', path: '/projetos' },
    { id: 'planejamentos', icon: FileText, label: 'Planejamentos', path: '/meus-planejamentos' },
    { id: 'clientes', icon: Users, label: 'Clientes', path: '/clients' },
    { id: 'equipe', icon: UsersRound, label: 'Equipe', path: '/equipe' },
    { id: 'pacotes', icon: Package, label: 'Serviços', path: '/packages' },
    { id: 'modelos', icon: LayoutTemplate, label: 'Modelos', path: '/modelos' },
    { id: 'creditos', icon: CreditCard, label: 'Créditos', path: '/credits' },
    { id: 'tarefas', icon: CheckSquare, label: 'Tarefas Diárias', path: '/tarefas' },
    { id: 'teleprompter', icon: Tv, label: 'Teleprompter', path: '/teleprompter' },
    { id: 'painel_master', icon: Shield, label: 'Painel Master', path: '/painel-master' },
    { id: 'diagnostico', icon: Database, label: 'Teste Tabela', path: '/diagnostico' }
  ];

  const navItems = ALL_MODULES.filter(mod => {
    if (mod.id === 'planejamentos' && userRole === 'cliente') return false;
    if (mod.id === 'painel_master' && userRole === 'master') return true;
    if (mod.id === 'diagnostico' && userRole === 'master') return true;
    if (mod.id === 'teleprompter' && userRole === 'master') return true;
    return permissions[mod.id]?.[userRole] === true;
  });

  if (navItems.length === 0) {
    navItems.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' });
  }

  return (
    <div className="min-h-screen bg-[#131313] text-[#e2e2e2] font-sans selection:bg-[#ff5351]/30 selection:text-white text-left">
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-xl border-b border-zinc-800 z-[200] flex items-center justify-between px-6">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ff5351] animate-pulse" />
            <span className="text-xl font-black tracking-tighter uppercase text-white">{firstName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 relative" ref={dropdownRef}>
          <button
            onClick={() => navigate('/teleprompter')}
            className="flex md:hidden p-2 text-zinc-400 hover:text-white transition-all group"
            title="Teleprompter"
          >
            <Tv className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
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

          {showNotificationDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-[#1a1a1a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[300]">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white italic">Notificações</span>
                {pendingNotifications.length > 0 && (
                  <span className="px-2 py-0.5 bg-[#ff5351] text-white text-[9px] font-black rounded-full">{pendingNotifications.length}</span>
                )}
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {pendingNotifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">Tudo limpo!</p>
                  </div>
                ) : (
                  pendingNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full p-4 text-left border-b border-zinc-800/50 hover:bg-[#ff5351]/5 transition-all flex items-start gap-3 group/item"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#ff5351] mt-1.5 shadow-[0_0_8px_rgba(255,83,81,0.4)]" />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold text-white uppercase truncate group-hover/item:text-[#ff5351] transition-colors">{notif.titulo}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">{notif.descricao}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover/item:text-[#ff5351] transition-colors" />
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => { setShowNotificationDropdown(false); navigate('/tarefas'); }}
                className="w-full p-4 bg-zinc-900/50 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border-t border-zinc-800 flex items-center justify-center gap-2"
              >
                Ver todas as tarefas <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex pt-16">
        <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-16 bottom-0 bg-[#0e0e0e] border-r border-zinc-800 p-4">
          <div className="mb-8 px-2 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#ff5351] font-black text-sm">{initials}</div>
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-white truncate max-w-[140px]">{firstName}</div>
              <div className="text-[10px] uppercase tracking-widest text-[#ff5351] font-black italic">{userRole}</div>
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
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-[#ff5351] transition-all text-sm font-medium">
              <LogOut className="w-4 h-4" />Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
