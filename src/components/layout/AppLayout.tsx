import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Library, 
  Users, 
  HelpCircle, 
  LogOut,
  Bell,
  Settings,
  X,
  Loader2,
  Image as ImageControl,
  Trash2,
  Save,
  Package
} from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';
import { settingsService, GlobalSettings } from '@/src/services/settingsService';
import { useProjectStore } from '@/src/store/useProjectStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;
  const { currentProjectName, currentProjectEmail } = useProjectStore();
  const [showGlobalSettings, setShowGlobalSettings] = React.useState(false);
  const [globalSettings, setGlobalSettings] = React.useState<GlobalSettings | null>(null);
  const [uploadingWatermark, setUploadingWatermark] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await settingsService.getSettings();
    setGlobalSettings(s);
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert('Por favor, selecione apenas arquivos PNG para a marca d\'água.');
      return;
    }

    setUploadingWatermark(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setGlobalSettings(prev => ({ ...prev, watermarkUrl: base64 }));
      setUploadingWatermark(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    if (!globalSettings) return;
    setSavingSettings(true);
    try {
      await settingsService.updateSettings(globalSettings);
      setShowGlobalSettings(false);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      alert('Erro ao salvar.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const isAdmin = user?.email === 'boranovfilms@gmail.com';

  const navItems = isAdmin ? [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Library, label: 'Projetos', path: '/' },
    { icon: Users, label: 'Clientes', path: '/clients' },
    { icon: Package, label: 'Cadastro de Pacotes', path: '/packages' },
  ] : [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  ];

  return (
    <div className="min-h-screen bg-[#131313] text-[#e2e2e2] font-sans selection:bg-[#ff5351]/30 selection:text-white">
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-xl border-b border-zinc-800 z-[200] flex items-center justify-between px-6">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ff5351] animate-pulse" />
            <span className="text-xl font-black tracking-tighter uppercase text-white">BORA SELECT</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <NavLink
              to="/"
              className={({ isActive }) => cn(
                'text-sm font-semibold transition-all pb-1 border-b-2',
                isActive ? 'text-white border-[#ff5351]' : 'text-zinc-500 border-transparent hover:text-zinc-300'
              )}
            >
              Dashboard
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/clients"
                className={({ isActive }) => cn(
                  'text-sm font-semibold transition-all pb-1 border-b-2',
                  isActive ? 'text-white border-[#ff5351]' : 'text-zinc-500 border-transparent hover:text-zinc-300'
                )}
              >
                Clientes
              </NavLink>
            )}

            {isAdmin && (
              <NavLink
                to="/packages"
                className={({ isActive }) => cn(
                  'text-sm font-semibold transition-all pb-1 border-b-2',
                  isActive ? 'text-white border-[#ff5351]' : 'text-zinc-500 border-transparent hover:text-zinc-300'
                )}
              >
                Pacotes
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-zinc-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>

          {isAdmin && (
            <button 
              onClick={() => setShowGlobalSettings(true)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {showGlobalSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGlobalSettings(false)} />
          <div className="relative w-full max-w-md bg-[#222222] rounded-[40px] border border-zinc-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#ff5351]/10 rounded-lg">
                  <Settings className="w-5 h-5 text-[#ff5351]" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                  Configurações
                </h3>
              </div>
              <button onClick={() => setShowGlobalSettings(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-all">
                <X className="w-6 h-6" />
              </button>
            </header>
            
            <div className="p-8 space-y-10">
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 mb-4 block">
                  MARCA D'ÁGUA GLOBAL (PNG)
                </label>
                <div className="flex flex-col items-center gap-6 p-10 border-2 border-dashed border-zinc-700/50 rounded-3xl bg-zinc-950/30 hover:border-[#ff5351] transition-all group">
                  {globalSettings?.watermarkUrl ? (
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/50 flex items-center justify-center border border-zinc-800">
                      <img src={globalSettings.watermarkUrl} alt="Watermark Preview" className="max-w-[80%] max-h-[80%] object-contain" />
                      <button 
                        onClick={() => setGlobalSettings(prev => ({ ...prev, watermarkUrl: '' }))}
                        className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-[#ff5351] font-black uppercase text-xs tracking-widest backdrop-blur-sm"
                      >
                        <Trash2 className="w-5 h-5 mr-3" />
                        Remover Marca
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-6 cursor-pointer w-full">
                      <input 
                        type="file" 
                        accept="image/png" 
                        onChange={handleWatermarkUpload}
                        className="hidden" 
                      />
                      <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center group-hover:bg-[#ff5351]/10 group-hover:text-[#ff5351] transition-all border border-zinc-800 shadow-xl">
                        {uploadingWatermark ? <Loader2 className="w-10 h-10 animate-spin" /> : <ImageControl className="w-10 h-10 text-zinc-600 group-hover:text-[#ff5351]" />}
                      </div>
                      <div className="text-center">
                        <p className="text-white font-black uppercase tracking-tight mb-2">Upload de Marca d'água</p>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-[200px] mx-auto">
                          Selecione um arquivo .PNG transparente para proteger seu catálogo.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <footer className="p-8 bg-zinc-900 border-t border-zinc-800 flex gap-4">
              <button 
                onClick={() => setShowGlobalSettings(false)}
                className="flex-1 px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 px-4 py-4 bg-white text-black text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#ff5351] hover:text-white transition-all flex items-center justify-center gap-2 shadow-2xl"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Marca
              </button>
            </footer>
          </div>
        </div>
      )}

      <div className="flex pt-16">
        <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-16 bottom-0 bg-[#0e0e0e] border-r border-zinc-800 p-4">
          <div className="mb-8 px-2 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <Users className="w-6 h-6" />
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-white truncate max-w-[140px]">
                {location.pathname.includes('/review/') ? (
                  currentProjectName || 'Sessão de Cliente'
                ) : (
                  user?.displayName || 'Bora Select'
                )}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                {location.pathname.includes('/review/') ? (
                  currentProjectEmail || 'Modo Visualização'
                ) : (
                  'Dashboard Admin'
                )}
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.label + item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium',
                  isActive
                    ? 'bg-zinc-800/50 text-[#ff5351] border-l-2 border-[#ff5351]'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-zinc-800 space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white transition-all text-sm font-medium">
              <HelpCircle className="w-4 h-4" />
              Help
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-[#ff5351] transition-all text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-lg border-t border-zinc-800 flex items-center justify-around px-4 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.label + item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1',
              isActive ? 'text-[#ff5351]' : 'text-zinc-500'
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] uppercase font-bold tracking-widest">
              {item.label.split(' ')[0]}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
