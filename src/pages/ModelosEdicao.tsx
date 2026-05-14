import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Plus, 
  LayoutTemplate, 
  GripVertical, 
  Clock, 
  UserCircle, 
  ShieldAlert, 
  CheckCircle2, 
  Settings2,
  MoreVertical,
  PlayCircle,
  Save
} from 'lucide-react';
import { cn } from '../lib/utils';
import { MOCK_MODELS } from './ModelosFluxo'; // Pegando os mesmos falsos da lista

// --- DADOS FALSOS (ETAPAS DO MODELO) ---
const MOCK_STAGES = [
  { id: 's1', name: 'Alinhamento & Roteiro', duration: '1 dia', assignee: 'Atendimento', requiresApproval: true, isBlocked: false },
  { id: 's2', name: 'Gravação em Estúdio', duration: '1 dia', assignee: 'Produção', requiresApproval: false, isBlocked: true },
  { id: 's3', name: 'Backup & Decupagem', duration: '1 dia', assignee: 'Edição', requiresApproval: false, isBlocked: true },
  { id: 's4', name: 'Edição Inicial', duration: '3 dias', assignee: 'Edição', requiresApproval: false, isBlocked: true },
  { id: 's5', name: 'Aprovação do Cliente', duration: 'Variável', assignee: 'Atendimento', requiresApproval: true, isBlocked: true },
  { id: 's6', name: 'Entrega Final', duration: '1 dia', assignee: 'Atendimento', requiresApproval: false, isBlocked: true },
];
// ----------------------------------------

export default function ModelosEdicao() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Na vida real faremos um fetch no Firestore, aqui usamos o mock
  const modelData = MOCK_MODELS.find(m => m.id === id) || MOCK_MODELS[0];

  return (
    <div className="space-y-8 pb-16">
      
      {/* Botão voltar */}
      <button 
        onClick={() => navigate('/modelos')}
        className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Voltar para a Lista
      </button>

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className={cn('w-16 h-16 rounded-3xl border flex items-center justify-center shrink-0', modelData.bgColor, modelData.borderColor)}>
              <modelData.icon className={cn('w-7 h-7', modelData.color)} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#ff5351] font-black mb-1">
                Editando estrutura do fluxo
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
                {modelData.name}
              </h1>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button className="h-12 px-6 rounded-2xl border border-zinc-700 bg-[#101010] hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2">
            <Settings2 className="w-4 h-4" />
            Configurações
          </button>
          <button className="h-12 px-6 rounded-2xl bg-[#ff5351] hover:bg-[#ff5351]/90 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20">
            <Save className="w-4 h-4" />
            Salvar Fluxo
          </button>
        </div>
      </header>

      <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden">
        
        <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-white text-xl font-black uppercase tracking-widest">
              Etapas do Processo
            </h3>
            <p className="text-zinc-500 text-sm mt-1">
              Defina a ordem exata das tarefas. Novos projetos herdarão essa estrutura.
            </p>
          </div>
          <button className="h-10 px-5 rounded-xl bg-white text-black hover:bg-zinc-200 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" />
            Nova Etapa
          </button>
        </div>

        <div className="p-8">
          {/* LISTA DE ETAPAS */}
          <div className="space-y-3">
            {MOCK_STAGES.map((stage, index) => (
              <div 
                key={stage.id}
                className="group flex items-stretch bg-[#151515] border border-zinc-800 rounded-2xl overflow-hidden hover:border-[#ff5351]/30 transition-all hover:shadow-[0_0_20px_rgba(255,83,81,0.05)]"
              >
                {/* Handle de arrastar */}
                <div className="w-12 bg-zinc-900/50 border-r border-zinc-800 flex items-center justify-center cursor-grab text-zinc-600 group-hover:text-[#ff5351] group-hover:bg-[#ff5351]/5 transition-colors">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Conteúdo da etapa */}
                <div className="flex-1 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-black text-sm shadow-inner group-hover:border-[#ff5351]/30 group-hover:text-white transition-all">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-black uppercase text-base">{stage.name}</h4>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <Clock className="w-4 h-4 text-zinc-500" />
                          Duração: <strong className="text-white">{stage.duration}</strong>
                        </span>
                        <span className="text-zinc-700">•</span>
                        <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                          <UserCircle className="w-4 h-4 text-zinc-500" />
                          Responsável padrão: <strong className="text-white">{stage.assignee}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {stage.requiresApproval && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprovação de Cliente
                      </span>
                    )}
                    {stage.isBlocked && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Bloqueia Avanço
                      </span>
                    )}
                    
                    <div className="w-px h-8 bg-zinc-800 mx-2 hidden lg:block" />

                    <button className="h-9 px-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                      Editar
                    </button>
                    <button className="p-2 text-zinc-600 hover:text-[#ff5351] hover:bg-[#ff5351]/10 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 py-10 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4 shadow-xl">
               <LayoutTemplate className="w-7 h-7" />
             </div>
             <p className="text-white font-black uppercase text-lg mb-2">Estrutura do Processo</p>
             <p className="text-zinc-500 text-sm font-medium max-w-md">
               Arraste os blocos pelas laterais esquerdas para reordenar a prioridade de cada passo operacional.
             </p>
          </div>
        </div>
      </section>
    </div>
  );
}
