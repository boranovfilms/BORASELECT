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
  const [plans, setPlans] = useState([]); const [loading, setLoading] = useState(true); const navigate = useNavigate(); useEffect(() => { loadMyPlans(); }, []); const loadMyPlans = async () => { setLoading(true); try { const userEmail = auth.currentUser?.email; if (!userEmail) { toast.error('Usuário não autenticado.'); return; } // 1. Busca o ID do documento do cliente diretamente na coleção 'clientes' pelo e-mail const clientesRef = collection(db, 'clientes'); const qClient = query(clientesRef, where('email', '==', userEmail.toLowerCase().trim())); const clientSnap = await getDocs(qClient); if (!clientSnap.empty) { // Encontrou o cliente, agora busca os planejamentos vinculados ao ID do documento dele const clientId = clientSnap.docs[0].id; const data = await contentPlanService.getPlansByClient(clientId); setPlans(data); } else { // Caso o usuário logado não seja um cliente (ex: Admin sem registro na col 'clientes') if (userEmail === 'boranovfilms@gmail.com') { toast.error('O perfil Master deve visualizar planejamentos através da tela de Gestão de Clientes.'); } else { console.warn('Nenhum registro de cliente encontrado para este e-mail.'); } } } catch (error) { console.error('Erro ao carregar planejamentos:', error); toast.error('Erro ao carregar seus planejamentos.'); } finally { setLoading(false); } }; const getStatusBadge = (status: string) => { const configs: any = { rascunho: { label: 'Em Edição', class: 'bg-zinc-800 text-zinc-400' }, aguardando_cliente: { label: 'Sua Aprovação', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }, aguardando_validacao_equipe: { label: 'Validação Interna', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }, aprovado: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }, devolvido: { label: 'Ajustes Pendentes', class: 'bg-red-500/10 text-red-400 border-red-500/20' }, }; const config = configs[status] || configs.rascunho; return {config.label}; }; if (loading) return ; return ( 

  
Seus Materiais

 
# Planejamentos

 
Acompanhe e valide as estratégias de conteúdo criadas para você.

   navigate(`/planejamento/${plan.id}`)} emptyMessage="Nenhum planejamento disponível para visualização no momento." columns={[ { header: 'Campanha', accessor: (plan) => ( 

 

 

 
{plan.name}

 
{plan.monthReference}

 

 

 ) }, { header: 'Status', accessor: (plan) => getStatusBadge(plan.status), align: 'center' }, { header: 'Última Interação', accessor: (plan) => { const date = plan.updatedAt?.toDate ? plan.updatedAt.toDate() : new Date(plan.updatedAt); return ( 

  {new Intl.DateTimeFormat('pt-BR').format(date)} 

 ); } } ]} actions={(plan) => (  Abrir Detalhes   )} /> 

 ); }
