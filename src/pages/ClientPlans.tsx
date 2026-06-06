import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Loader2, Clock } from 'lucide-react';
import { contentPlanService, ContentPlan } from '../services/contentPlanService';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { DataTable } from '../components/ui/DataTable';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function ClientPlans() {
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadMyPlans();
  }, []);

  const loadMyPlans = async () => {
    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) {
        toast.error('Usuário não autenticado.');
        return;
      }

      // 1. Busca o ID do documento do cliente diretamente na coleção 'clientes' pelo e-mail
      const clientsRef = collection(db, 'clientes');
      const qClient = query(clientsRef, where('email', '==', userEmail.toLowerCase().trim()));
      const clientSnap = await getDocs(qClient);

      if (!clientSnap.empty) {
        // Encontrou o cliente, agora busca os planejamentos vinculados ao ID do documento dele
        const clientId = clientSnap.docs[0].id;
        const data = await contentPlanService.getPlansByClient(clientId);
        setPlans(data);
      } else {
        // Caso o usuário logado não seja um cliente (ex: Admin sem registro na col 'clientes')
        if (userEmail === 'boranovfilms@gmail.com') {
          toast.error('O perfil Master deve visualizar planejamentos através da tela de Gestão de Clientes.');
        } else {
          console.warn('Nenhum registro de cliente encontrado para este e-mail.');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar planejamentos:', error);
      toast.error('Erro ao carregar seus planejamentos.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: any = {
      rascunho: { label: 'Em Edição', class: 'bg-zinc-800 text-zinc-400' },
      aguardando_cliente: { label: 'Sua Aprovação', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_validacao_equipe: { label: 'Validação Interna', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      aprovado: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      devolvido: { label: 'Ajustes Pendentes', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = configs[status] || configs.rascunho;
    return <span className={cn("px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest", config.class)}>{config.label}</span>;
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <header>
        <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Seus Materiais</p>
        <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Planejamentos</h1>
        <p className="text-zinc-500 text-lg mt-2">Acompanhe e valide as estratégias de conteúdo criadas para você.</p>
      </header>

      <DataTable 
        data={plans}
        onRowClick={(plan) => navigate(`/planejamento/${plan.id}`)}
        emptyMessage="Nenhum planejamento disponível para visualização no momento."
        columns={[
          {
            header: 'Campanha',
            accessor: (plan) => (
              <div className="flex items-center gap-3 py-1">
                <div className="p-2.5 bg-[#ff5351]/10 rounded-xl border border-[#ff5351]/20">
                  <FileText className="w-5 h-5 text-[#ff5351]" />
                </div>
                <div>
                  <p className="text-white font-black uppercase text-sm">{plan.name}</p>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">{plan.monthReference}</p>
                </div>
              </div>
            )
          },
          { header: 'Status', accessor: (plan) => getStatusBadge(plan.status), align: 'center' },
          { 
            header: 'Última Interação', 
            accessor: (plan) => {
              const date = plan.updatedAt?.toDate ? plan.updatedAt.toDate() : new Date(plan.updatedAt);
              return (
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  {new Intl.DateTimeFormat('pt-BR').format(date)}
                </div>
              );
            }
          }
        ]}
        actions={(plan) => (
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-[#ff5351] transition-all">
            Abrir Detalhes
            <ChevronRight className="w-3 h-3 text-[#ff5351]" />
          </button>
        )}
      />
    </div>
  );
}