import { useState, useEffect } from 'react';
import { Shield, Save, Loader2, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { permissionsService, PermissionsMatrix } from '../services/permissionsService';
import { ALL_MODULES } from '../config/modules';

const ROLES = [
  { id: 'master', label: 'Master / Direção' },
  { id: 'admin', label: 'Administrativo' },
  { id: 'redator', label: 'Redator' },
  { id: 'editor', label: 'Editor de Vídeo' },
  { id: 'designer', label: 'Designer' },
  { id: 'midia_social', label: 'Mídia Social' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'equipe', label: 'Equipe Cliente' }
];

export default function PainelMaster() {
  const [permissions, setPermissions] = useState<PermissionsMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPermissions(); }, []);

  const loadPermissions = async () => {
    try {
      const data = await permissionsService.getPermissions();
      setPermissions(data || {});
    } catch (error) { toast.error('Erro ao carregar permissões'); } finally { setLoading(false); }
  };

  const togglePermission = (moduleId: string, roleId: string) => {
    if (roleId === 'master') return; // master nunca pode ser desmarcado
    setPermissions(prev => {
      const current = prev[moduleId] || {};
      return { ...prev, [moduleId]: { ...current, [roleId]: !current[roleId] } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Garante que master sempre esteja marcado para todos os módulos antes de salvar
      const permissionsWithMaster: PermissionsMatrix = {};
      ALL_MODULES.forEach(mod => {
        const perms = permissions[mod.id] || {};
        permissionsWithMaster[mod.id] = { ...perms, master: true };
      });

      await permissionsService.savePermissions(permissionsWithMaster);
      toast.success('Matriz salva com sucesso!');
    } catch (error) { toast.error('Erro ao salvar no banco.'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  return (
    <div className="animate-in fade-in duration-700 pb-20 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-2">Segurança</p>
          <h1 className="text-3xl font-black text-white uppercase italic flex items-center gap-3"><Shield className="w-8 h-8 text-[#ff5351]" /> Matriz de Controle</h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="h-12 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[10px] hover:brightness-110 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </header>

      <div className="bg-[#141414] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto p-4 md:p-6">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="pb-4 pt-2 w-[180px] sticky left-0 bg-[#141414] z-20"></th>
                {ROLES.map((role) => (
                  <th key={role.id} className="pb-4 pt-2 px-1 text-center align-bottom min-w-[90px]"><span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 block leading-tight">{role.label}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MODULES.map((mod) => (
                <tr key={mod.id} className="group border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/10 transition-colors">
                  <td className="py-4 pr-2 sticky left-0 bg-[#141414] z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-[#ff5351]/40 transition-colors">
                        <mod.icon className="w-4 h-4 text-zinc-400 group-hover:text-[#ff5351]" />
                      </div>
                      <p className="text-white font-bold text-xs">{mod.label}</p>
                    </div>
                  </td>
                  {ROLES.map((role) => {
                    const isMaster = role.id === 'master';
                    const checked = isMaster || !!permissions[mod.id]?.[role.id];
                    return (
                      <td key={role.id} className="py-4 px-1 text-center">
                        <button
                          onClick={() => togglePermission(mod.id, role.id)}
                          disabled={isMaster}
                          title={isMaster ? 'Master sempre tem acesso' : undefined}
                          className={cn(
                            "w-8 h-8 md:w-9 md:h-9 rounded-xl mx-auto flex items-center justify-center transition-all duration-300 relative",
                            checked
                              ? "bg-[#ff5351] shadow-[0_0_15px_rgba(255,83,81,0.35)] scale-110"
                              : "bg-[#1a1a1a] border border-zinc-800 hover:border-zinc-600",
                            isMaster && "cursor-not-allowed opacity-90"
                          )}
                        >
                          {checked && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
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
