import { useState, useEffect } from 'react';
import { 
  Shield, 
  Save, 
  LayoutDashboard, 
  Library, 
  Users, 
  Package, 
  LayoutTemplate, 
  CreditCard, 
  Settings, 
  Check,
  Loader2,
  CheckSquare,
  UsersRound
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { permissionsService, PermissionsMatrix } from '../services/permissionsService';

const ROLES = [
  { id: 'master', label: 'Master' },
  { id: 'editor', label: 'Editor de video' },
  { id: 'designer', label: 'Designer' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'equipe', label: 'Equipe cliente' },
  { id: 'redator', label: 'Redator' },
  { id: 'midia_social', label: 'Mídia Social' }
];

const MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projetos', label: 'Projetos', icon: Library },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'equipe', label: 'Gestão de Equipe', icon: UsersRound },
  { id: 'pacotes', label: 'Cadastro de Pacotes', icon: Package },
  { id: 'modelos', label: 'Modelos', icon: LayoutTemplate },
  { id: 'creditos', label: 'Créditos', icon: CreditCard },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
  { id: 'painel_master', label: 'Painel Master', icon: Shield },
  { id: 'tarefas', label: 'Tarefas Diárias', icon: CheckSquare }
];

export default function PainelMaster() {
  const [permissions, setPermissions] = useState<PermissionsMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const data = await permissionsService.getPermissions();
      const perms = data || {};

      // Aplicando as permissões padrão para os novos perfis se não existirem no banco ainda
      const defaultModules = ['dashboard', 'projetos', 'tarefas'];
      const newRoles = ['redator', 'midia_social'];

      newRoles.forEach(roleId => {
        defaultModules.forEach(modId => {
          if (!perms[modId]) perms[modId] = {};
          if (perms[modId][roleId] === undefined) {
            perms[modId][roleId] = true;
          }
        });
      });

      setPermissions(perms);
    } catch (error) {
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (moduleId: string, roleId: string) => {
    if (moduleId === 'painel_master' && roleId === 'master') {
      toast.error('O Master sempre deve ter acesso ao Painel Master.');
      return;
    }

    setPermissions(prev => {
      const currentModulePerms = prev[moduleId] || {};
      return {
        ...prev,
        [moduleId]: {
          ...currentModulePerms,
          [roleId]: !currentModulePerms[roleId]
        }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await permissionsService.savePermissions(permissions);
      toast.success('Matriz de controle salva com sucesso! O menu será atualizado ao recarregar a página.');
    } catch (error) {
      toast.error('Erro ao salvar no banco de dados.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700 pb-20 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-2">
            Nível de Acesso
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#ff5351]" />
            Matriz de Controle
          </h1>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,83,81,0.2)] flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </header>

      <div className="bg-[#141414] border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto p-4 md:p-6">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="pb-4 pt-2 w-[180px] sticky left-0 bg-[#141414] z-20"></th>
                {ROLES.map((role) => (
                  <th key={role.id} className="pb-4 pt-2 px-1 text-center align-bottom min-w-[90px]">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 block leading-tight px-1">
                      {role.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, index) => (
                <tr 
                  key={mod.id} 
                  className={cn(
                    "group transition-all duration-300",
                    index !== MODULES.length - 1 && "border-b border-zinc-800/40"
                  )}
                >
                  <td className="py-3 pr-2 sticky left-0 bg-[#141414] z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-[#ff5351]/40 transition-colors">
                        <mod.icon className="w-4 h-4 text-zinc-400 group-hover:text-[#ff5351] transition-colors" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-xs">{mod.label}</p>
                        <p className="text-zinc-600 text-[8px] uppercase tracking-[0.2em] font-black mt-0.5">Sistema</p>
                      </div>
                    </div>
                  </td>
                  {ROLES.map((role) => {
                    const hasAccess = permissions[mod.id]?.[role.id] || false;
                    return (
                      <td key={`${mod.id}-${role.id}`} className="py-3 px-1 text-center">
                        <button
                          onClick={() => togglePermission(mod.id, role.id)}
                          className={cn(
                            "w-8 h-8 md:w-9 md:h-9 rounded-xl mx-auto flex items-center justify-center transition-all duration-300 relative",
                            hasAccess 
                              ? "bg-[#ff5351] shadow-[0_0_15px_rgba(255,83,81,0.35)] scale-100 hover:scale-110" 
                              : "bg-[#1a1a1a] border border-zinc-800 hover:border-zinc-600 hover:bg-[#202020] scale-100"
                          )}
                        >
                          {hasAccess && (
                            <Check 
                              className="w-4 h-4 md:w-5 md:h-5 text-white font-black animate-in zoom-in duration-200" 
                              strokeWidth={4} 
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
