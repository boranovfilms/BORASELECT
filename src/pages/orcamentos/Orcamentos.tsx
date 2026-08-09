import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Loader2, FileText, Trash2, Edit2, Eye, Settings, Package, ChevronRight, ChevronDown, ChevronUp, Printer, LayoutTemplate } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { gerarOrcamentoPdf } from './gerarPdf';
import { getDoc } from 'firebase/firestore';

interface Orcamento {
  id?: string;
  numero: string;
  versao: number;
  nomeCliente: string;
  nomeComercial?: string;
  nomeEvento: string;
  valorCliente: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'reprovado' | 'alterado' | 'cancelado';
  pdfGerado?: boolean;
  somenteLeitura?: boolean;
  criadoEm?: any;
  updatedAt?: any;
  // campos necessários para gerar PDF
  cnpjCpf?: string;
  emailPrincipal?: string;
  telefone?: string;
  responsavel?: string;
  localEvento?: string;
  dataEventoInicio?: string;
  dataEventoFim?: string;
  diarias?: number;
  condicaoPagamento?: string;
  blocos?: any[];
  extras?: any[];
  despAlimentacao?: number;
  despTransporte?: number;
  despHospedagem?: number;
  despPedagio?: number;
  observacoes?: string;
  nomeEvento2?: string;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  rascunho: { label: 'Gerado', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  enviado: { label: 'Enviado', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  aprovado: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  reprovado: { label: 'Reprovado', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
  alterado: { label: 'Alterado', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  cancelado: { label: 'Cancelado', class: 'bg-zinc-800 text-zinc-600 border-zinc-700' },
};

function primeiroSegundoNome(nome: string): string {
  if (!nome) return '—';
  const partes = nome.trim().split(' ');
  return partes.slice(0, 2).join(' ');
}

function numeroBase(numero: string): string {
  return numero?.split('-v')[0] || numero;
}

export default function Orcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orcamentos'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Orcamento[];
      data.sort((a, b) => {
        const dateA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(0);
        const dateB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setOrcamentos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Agrupa por número base e pega a última versão de cada grupo
  const orcamentosAgrupados = () => {
    const grupos: Record<string, Orcamento[]> = {};
    orcamentos.forEach(orc => {
      const base = numeroBase(orc.numero);
      if (!grupos[base]) grupos[base] = [];
      grupos[base].push(orc);
    });

    // Ordena cada grupo por versão
    Object.keys(grupos).forEach(base => {
      grupos[base].sort((a, b) => (b.versao || 1) - (a.versao || 1));
    });

    // Retorna array com ultimo de cada grupo + versões anteriores
    return Object.values(grupos).map(grupo => ({
      atual: grupo[0],
      anteriores: grupo.slice(1),
    })).sort((a, b) => {
      const dateA = a.atual.criadoEm?.toDate ? a.atual.criadoEm.toDate() : new Date(0);
      const dateB = b.atual.criadoEm?.toDate ? b.atual.criadoEm.toDate() : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const handleExcluir = async (id: string, numero: string) => {
    if (!confirm(`Excluir orçamento ${numero}?`)) return;
    try {
      await deleteDoc(doc(db, 'orcamentos', id));
      toast.success('Orçamento excluído!');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleGerarPdf = async (orc: Orcamento) => {
    if (!orc.id) return;
    setGerandoPdf(orc.id);
    try {
      const configSnap = await getDoc(doc(db, 'configuracoes', 'orcamento'));
      const config = configSnap.exists() ? configSnap.data() : {};

      await gerarOrcamentoPdf({
        numero: orc.numero || '',
        nomeCliente: orc.nomeCliente || '',
        nomeComercial: orc.nomeComercial || '',
        nomeEvento: orc.nomeEvento || '',
        cnpjCpf: orc.cnpjCpf || '',
        emailPrincipal: orc.emailPrincipal || '',
        telefone: orc.telefone || '',
        responsavel: orc.responsavel || '',
        localEvento: orc.localEvento || '',
        dataEventoInicio: orc.dataEventoInicio || '',
        dataEventoFim: orc.dataEventoFim || '',
        diarias: orc.diarias || 1,
        condicaoPagamento: orc.condicaoPagamento || '',
        blocos: orc.blocos || [],
        extras: orc.extras || [],
        despAlimentacao: orc.despAlimentacao || 0,
        despTransporte: orc.despTransporte || 0,
        despHospedagem: orc.despHospedagem || 0,
        despPedagio: orc.despPedagio || 0,
        valorCliente: orc.valorCliente || 0,
        observacoes: orc.observacoes || '',
      }, {
        capaPdfUrl: config.capaPdfUrl || '',
        timbradoPdfUrl: config.timbradoPdfUrl || '',
        nomeEmpresa: config.nomeEmpresa || 'BORNOV',
        telefone: config.telefone || '',
        email: config.email || '',
        site: config.site || '',
        capaCoords: config.capaCoords || null,
        timbradoMargens: config.timbradoMargens || null,
      }, orc.nomeCliente?.trim().split(' ')[0] || 'BORANOV');

      // Marca como PDF gerado
      await updateDoc(doc(db, 'orcamentos', orc.id), { pdfGerado: true });
      toast.success('PDF gerado!');
    } catch (error: any) {
      toast.error(`Erro ao gerar PDF: ${error.message}`);
    } finally {
      setGerandoPdf(null);
    }
  };

  const totalAprovados = orcamentos.filter(o => o.status === 'aprovado').reduce((acc, o) => acc + (o.valorCliente || 0), 0);
  const totalEnviados = orcamentos.filter(o => o.status === 'enviado').length;
  const totalGerados = orcamentos.filter(o => o.status === 'rascunho').length;
  const grupos = orcamentosAgrupados();

  const RowOrcamento = ({ orc, isAnterior = false }: { orc: Orcamento; isAnterior?: boolean }) => (
    <tr className={cn('hover:bg-zinc-800/30 transition-all', isAnterior && 'bg-zinc-900/50')}>
      <td className="px-6 py-2">
        <div className="flex items-center gap-2">
          {isAnterior && <span className="w-3 h-3 text-zinc-600">↳</span>}
          <span className={cn('font-black text-sm', isAnterior ? 'text-zinc-500' : 'text-[#ff5351]')}>
            {orc.numero}
          </span>
          {isAnterior && (
            <span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-500 text-[8px] font-black uppercase rounded">
              anterior
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-2 text-white font-bold text-sm">
        {primeiroSegundoNome(orc.nomeCliente)}
      </td>
      <td className="px-6 py-2 text-zinc-400 text-sm">
        {orc.nomeEvento || '—'}
      </td>
      <td className="px-6 py-2 text-right">
        <span className={cn('font-black text-sm', isAnterior ? 'text-zinc-500' : 'text-emerald-400')}>
          {(orc.valorCliente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </td>
      <td className="px-6 py-2 text-center">
        <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest',
          STATUS_CONFIG[orc.status]?.class || STATUS_CONFIG.rascunho.class)}>
          {STATUS_CONFIG[orc.status]?.label || 'Gerado'}
        </span>
      </td>
      <td className="px-6 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Impressora — verde se nunca gerou, amarelo se já gerou */}
          <button
            onClick={() => handleGerarPdf(orc)}
            disabled={gerandoPdf === orc.id}
            title={orc.pdfGerado ? 'PDF já gerado — gerar novamente' : 'Gerar PDF'}
            className={cn(
              'p-1.5 transition-all',
              orc.pdfGerado ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300',
              gerandoPdf === orc.id && 'opacity-50'
            )}>
            {gerandoPdf === orc.id
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Printer className="w-3.5 h-3.5" />
            }
          </button>
          {/* Lápis — editar (só na versão atual) */}
          {!isAnterior && (
            <button
              onClick={() => navigate(`/orcamentos/${orc.id}`)}
              title="Editar orçamento"
              className="p-1.5 text-zinc-500 hover:text-white transition-all">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Excluir */}
          {!isAnterior && (
            <button
              onClick={() => orc.id && handleExcluir(orc.id, orc.numero)}
              title="Excluir"
              className="p-1.5 text-zinc-500 hover:text-red-400 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-8 pb-20 text-left">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Boranov</p>
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Orçamentos</h1>
            <button onClick={() => navigate('/orcamentos/editor-pdf')} title="Editor visual da capa"
              className="p-2 text-zinc-600 hover:text-white transition-all">
              <LayoutTemplate className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/orcamentos/configuracoes')} title="Configurações"
              className="p-2 text-zinc-600 hover:text-white transition-all">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <p className="text-zinc-500 text-sm mt-1">Gerencie propostas e orçamentos</p>
        </div>
        <button onClick={() => navigate('/orcamentos/novo')}
          className="h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </header>

      {/* Cards de acesso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => navigate('/orcamentos/templates')}
          className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-600 transition-all text-left">
          <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black uppercase text-sm">Templates</p>
            <p className="text-zinc-500 text-xs mt-0.5">Modelos de orçamento</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>

        <button onClick={() => navigate('/orcamentos/equipamentos')}
          className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-600 transition-all text-left">
          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black uppercase text-sm">Equipamentos</p>
            <p className="text-zinc-500 text-xs mt-0.5">Tabela de custos internos</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>

        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Aprovado</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalAprovados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <div className="flex gap-3 mt-3">
            <span className="text-[9px] font-black uppercase text-zinc-500">{totalEnviados} enviados</span>
            <span className="text-zinc-700">•</span>
            <span className="text-[9px] font-black uppercase text-zinc-500">{totalGerados} gerados</span>
          </div>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-black uppercase text-sm">Nenhum orçamento criado ainda</p>
          <p className="text-xs mt-2">Clique em "Novo Orçamento" para começar</p>
        </div>
      ) : (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              {grupos.length} orçamento{grupos.length > 1 ? 's' : ''}
            </h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Número</th>
                <th className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cliente</th>
                <th className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome do Evento</th>
                <th className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Valor</th>
                <th className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Status</th>
                <th className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {grupos.map(({ atual, anteriores }) => (
                <React.Fragment key={atual.id}>
                  <tr className="hover:bg-zinc-800/30 transition-all text-sm">
                    <td className="px-6 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#ff5351] font-black text-sm">{atual.numero}</span>
                        {anteriores.length > 0 && (
                          <button
                            onClick={() => setExpandido(expandido === atual.id ? null : atual.id!)}
                            title={`${anteriores.length} versão(ões) anterior(es)`}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-white transition-all">
                            <span className="text-[8px] font-black">{anteriores.length}</span>
                            {expandido === atual.id
                              ? <ChevronUp className="w-2.5 h-2.5" />
                              : <ChevronDown className="w-2.5 h-2.5" />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-2 text-white font-bold text-sm">
                      {primeiroSegundoNome(atual.nomeCliente)}
                    </td>
                    <td className="px-6 py-2 text-zinc-400 text-sm">{atual.nomeEvento || '—'}</td>
                    <td className="px-6 py-2 text-right">
                      <span className="text-emerald-400 font-black text-sm">
                        {(atual.valorCliente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest',
                        STATUS_CONFIG[atual.status]?.class || STATUS_CONFIG.rascunho.class)}>
                        {STATUS_CONFIG[atual.status]?.label || 'Gerado'}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleGerarPdf(atual)} disabled={gerandoPdf === atual.id}
                          title={atual.pdfGerado ? 'PDF já gerado — gerar novamente' : 'Gerar PDF'}
                          className={cn('p-1.5 transition-all',
                            atual.pdfGerado ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300',
                            gerandoPdf === atual.id && 'opacity-50')}>
                          {gerandoPdf === atual.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Printer className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => navigate(`/orcamentos/${atual.id}`)}
                          title="Editar orçamento"
                          className="p-1.5 text-zinc-500 hover:text-white transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => atual.id && handleExcluir(atual.id, atual.numero)}
                          title="Excluir"
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Versões anteriores expandidas */}
                  {expandido === atual.id && anteriores.map(ant => (
                    <tr key={ant.id} className="bg-zinc-900/50 hover:bg-zinc-800/20 transition-all">
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-2 pl-4">
                          <span className="text-zinc-600 text-xs">↳</span>
                          <span className="text-zinc-500 font-black text-xs">{ant.numero}</span>
                          <span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-600 text-[8px] font-black uppercase rounded">
                            anterior
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-2.5 text-zinc-500 text-xs">{primeiroSegundoNome(ant.nomeCliente)}</td>
                      <td className="px-6 py-2.5 text-zinc-600 text-xs">{ant.nomeEvento || '—'}</td>
                      <td className="px-6 py-2.5 text-right">
                        <span className="text-zinc-500 text-xs font-black">
                          {(ant.valorCliente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-600 border-zinc-700">
                          v{ant.versao || 1}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleGerarPdf(ant)} disabled={gerandoPdf === ant.id}
                            title="Gerar PDF desta versão"
                            className={cn('p-1.5 transition-all',
                              ant.pdfGerado ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300',
                              gerandoPdf === ant.id && 'opacity-50')}>
                            {gerandoPdf === ant.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Printer className="w-3 h-3" />}
                          </button>
                          <button onClick={() => navigate(`/orcamentos/${ant.id}`)}
                            title="Visualizar versão anterior"
                            className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-all">
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
