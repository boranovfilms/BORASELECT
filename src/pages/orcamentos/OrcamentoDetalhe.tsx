import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft, Plus, Loader2, Save, FileText, Trash2, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { gerarOrcamentoPdf } from './gerarPdf';

interface ItemBloco {
  equipamentoId: string;
  nome: string;
  quantidade: number;
  valorDia: number;
  valorTotal: number;
  tipo: 'proprio' | 'equipe' | 'locacao';
  exibirNoPdf: boolean;
}

interface BlocoServico {
  id: string;
  nome: string;
  templateId: string;
  valorManual: number;
  itens: ItemBloco[];
}

interface Extra {
  id: string;
  nome: string;
  valorDia: number;
  diarias: number;
  valor: number;
}

interface Orcamento {
  id?: string;
  numero: string;
  versao: number;
  nomeCliente: string;
  nomeEvento: string;
  cnpjCpf: string;
  emailPrincipal: string;
  razaoSocial: string;
  telefone: string;
  nomeComercial: string;
  website: string;
  responsavel: string;
  cep: string;
  endereco: string;
  numero_end: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  localEvento: string;
  dataEventoInicio: string;
  dataEventoFim: string;
  diarias: number;
  condicaoPagamento: string;
  blocos: BlocoServico[];
  extras: Extra[];
  despAlimentacao: number;
  despTransporte: number;
  despHospedagem: number;
  despPedagio: number;
  pctNota: number;
  pctMargem: number;
  totalCustoEquipe: number;
  totalCustoLocacao: number;
  totalCustoDesp: number;
  totalCustoNota: number;
  totalCustoReal: number;
  totalProprio: number;
  totalMargem: number;
  totalSugerido: number;
  valorCliente: number;
  lucroReal: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'reprovado' | 'alterado' | 'cancelado';
  somenteLeitura?: boolean;
  observacoes: string;
  criadoEm?: any;
  updatedAt?: any;
}

interface Equipamento {
  id: string;
  nome: string;
  categoria: string;
  valorDia: number;
}

interface Template {
  id: string;
  nome: string;
  tipo: string;
  itens: any[];
  condicaoPagamento: string;
}

const CONDICOES_PAGAMENTO = [
  '50% entrada + 50% na entrega',
  '100% antecipado',
  '30% entrada + 70% na entrega',
  'Dia 10 de cada mês',
  'À combinar',
];

const CATS_EQUIPE = ['Equipe/Freelance'];

function tipoAutomatico(categoria: string): 'proprio' | 'equipe' | 'locacao' {
  return CATS_EQUIPE.includes(categoria) ? 'equipe' : 'proprio';
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isCnpj(v: string) {
  return v.replace(/\D/g, '').length === 14;
}

function primeiroNome(nome: string): string {
  if (!nome) return 'BORANOV';
  return nome.trim().split(' ')[0];
}

export default function OrcamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNovo = id === 'novo';

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [dadosExpandidos, setDadosExpandidos] = useState(false);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [somenteLeitura, setSomenteLeitura] = useState(false);

  const [form, setForm] = useState<Partial<Orcamento>>({
    numero: '',
    versao: 1,
    nomeCliente: '', nomeEvento: '', cnpjCpf: '', emailPrincipal: '',
    razaoSocial: '', telefone: '', nomeComercial: '', website: '', responsavel: '',
    cep: '', endereco: '', numero_end: '', complemento: '', bairro: '', cidade: '', estado: '',
    localEvento: '', dataEventoInicio: '', dataEventoFim: '',
    diarias: 1, condicaoPagamento: '50% entrada + 50% na entrega',
    blocos: [], extras: [],
    despAlimentacao: 0, despTransporte: 0, despHospedagem: 0, despPedagio: 0,
    pctNota: 0, pctMargem: 20,
    totalCustoEquipe: 0, totalCustoLocacao: 0, totalCustoDesp: 0,
    totalCustoNota: 0, totalCustoReal: 0, totalProprio: 0,
    totalMargem: 0, totalSugerido: 0, valorCliente: 0, lucroReal: 0,
    status: 'rascunho', observacoes: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const eqSnap = await getDocs(collection(db, 'orcamentoEquipamentos'));
        const eqData = eqSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Equipamento[];
        eqData.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
        setEquipamentos(eqData);

        const tSnap = await getDocs(collection(db, 'orcamentoTemplates'));
        const tData = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Template[];
        setTemplates(tData);

        if (!isNovo && id) {
          const docSnap = await getDoc(doc(db, 'orcamentos', id));
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as Orcamento;
            setForm(data);
            setSomenteLeitura(data.somenteLeitura || false);
          }
        } else {
          const orcSnap = await getDocs(collection(db, 'orcamentos'));
          const ano = new Date().getFullYear();
          const numerosBase = new Set(
            orcSnap.docs
              .map(d => d.data().numero as string)
              .map(n => n.split('-v')[0])
          );
          const proximo = (numerosBase.size + 1).toString().padStart(3, '0');
          setForm(prev => ({ ...prev, numero: `${proximo}-${ano}-v1`, versao: 1 }));
        }
      } catch {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const buscarCnpj = async () => {
    const cnpjLimpo = (form.cnpjCpf || '').replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) { toast.error('CNPJ inválido'); return; }
    setBuscandoCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!res.ok) { toast.error('CNPJ não encontrado'); return; }
      const data = await res.json();
      updateForm({
        razaoSocial: data.razao_social || '',
        nomeComercial: data.nome_fantasia || '',
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : '',
        cep: data.cep?.replace(/\D/g, '') || '',
        endereco: data.logradouro || '',
        numero_end: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || '',
        estado: data.uf || '',
      });
      setDadosExpandidos(true);
      toast.success('Dados preenchidos automaticamente!');
    } catch {
      toast.error('Erro ao buscar CNPJ');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const calcular = (f: Partial<Orcamento>) => {
    const diarias = f.diarias || 1;
    let custoEquipe = 0, custoLocacao = 0, valorProprio = 0;

    (f.blocos || []).forEach(bloco => {
      let blocoEquipe = 0, blocoLocacao = 0, blocoProprio = 0;
      bloco.itens.forEach(item => {
        const v = item.valorDia * item.quantidade * diarias;
        if (item.tipo === 'equipe') blocoEquipe += v;
        else if (item.tipo === 'locacao') blocoLocacao += v;
        else blocoProprio += v;
      });
      if (bloco.valorManual > 0) {
        const autoTotal = blocoEquipe + blocoLocacao + blocoProprio;
        const diff = bloco.valorManual - autoTotal;
        blocoProprio += diff;
      }
      custoEquipe += blocoEquipe;
      custoLocacao += blocoLocacao;
      valorProprio += blocoProprio;
    });

    const totalDesp = (f.despAlimentacao || 0) + (f.despTransporte || 0) + (f.despHospedagem || 0) + (f.despPedagio || 0);
    const totalExtras = (f.extras || []).reduce((acc, e) => acc + (e.valorDia || 0) * (e.diarias || 1), 0);
    const custoBase = custoEquipe + custoLocacao + totalDesp;
    const valorNota = custoBase * ((f.pctNota || 0) / 100);
    const custoTotal = custoBase + valorNota;
    const baseMargemCalculo = valorProprio + custoEquipe + custoLocacao + totalDesp;
    const valorMargem = baseMargemCalculo * ((f.pctMargem || 0) / 100);
    const sugerido = custoTotal + valorProprio + valorMargem + totalExtras;

    return {
      totalCustoEquipe: custoEquipe,
      totalCustoLocacao: custoLocacao,
      totalCustoDesp: totalDesp,
      totalCustoNota: valorNota,
      totalCustoReal: custoTotal,
      totalProprio: valorProprio,
      totalMargem: valorMargem,
      totalSugerido: sugerido,
      valorCliente: sugerido,
      lucroReal: sugerido - custoTotal,
    };
  };

  const updateForm = (updates: Partial<Orcamento>) => {
    setForm(prev => {
      const novo = { ...prev, ...updates };
      const calc = calcular(novo);
      return { ...novo, ...calc };
    });
  };

  const adicionarBloco = () => {
    const novoBloco: BlocoServico = { id: Date.now().toString(), nome: '', templateId: '', valorManual: 0, itens: [] };
    updateForm({ blocos: [...(form.blocos || []), novoBloco] });
  };

  const removerBloco = (blocoId: string) => {
    updateForm({ blocos: (form.blocos || []).filter(b => b.id !== blocoId) });
  };

  const carregarTemplate = (blocoId: string, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    const novosItens: ItemBloco[] = template ? template.itens.map((item: any) => ({
      equipamentoId: item.equipamentoId || '',
      nome: item.nome,
      quantidade: item.quantidade || 1,
      valorDia: item.valorDia,
      valorTotal: item.valorDia * (item.quantidade || 1),
      tipo: tipoAutomatico(item.categoria || ''),
      exibirNoPdf: item.exibirNoPdf !== false,
    })) : [];
    updateForm({
      blocos: (form.blocos || []).map(b =>
        b.id === blocoId ? { ...b, templateId, itens: novosItens, valorManual: 0 } : b
      )
    });
  };

  const toggleTipoItem = (blocoId: string, itemIdx: number) => {
    updateForm({
      blocos: (form.blocos || []).map(b => {
        if (b.id !== blocoId) return b;
        const novosItens = b.itens.map((item, i) => {
          if (i !== itemIdx) return item;
          if (item.tipo === 'proprio') return { ...item, tipo: 'locacao' as const };
          if (item.tipo === 'locacao') return { ...item, tipo: 'proprio' as const };
          return item;
        });
        return { ...b, itens: novosItens };
      })
    });
  };

  const adicionarExtra = () => {
    updateForm({
      extras: [...(form.extras || []), {
        id: Date.now().toString(),
        nome: '', valorDia: 0, diarias: 1, valor: 0,
      }]
    });
  };

  const removerExtra = (extraId: string) => {
    updateForm({ extras: (form.extras || []).filter(e => e.id !== extraId) });
  };

  const atualizarExtra = (extraId: string, campo: string, valor: any) => {
    updateForm({
      extras: (form.extras || []).map(e => {
        if (e.id !== extraId) return e;
        const atualizado = { ...e, [campo]: valor };
        atualizado.valor = (atualizado.valorDia || 0) * (atualizado.diarias || 1);
        return atualizado;
      })
    });
  };

  const handleSalvar = async () => {
    if (!form.nomeCliente?.trim()) { toast.error('Nome do cliente é obrigatório'); return; }
    if (!form.cnpjCpf?.trim()) { toast.error('CNPJ/CPF é obrigatório'); return; }
    setSalvando(true);
    try {
      const calc = calcular(form);
      const docId = form.id || id;

      if (!docId || docId === 'novo') {
        const dados = {
          ...form, ...calc,
          versao: 1,
          status: 'rascunho',
          somenteLeitura: false,
          updatedAt: serverTimestamp(),
          criadoEm: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'orcamentos'), dados);
        setForm(prev => ({ ...prev, id: ref.id, ...calc }));
        toast.success('Orçamento salvo!');
        navigate(`/orcamentos/${ref.id}`);
      } else {
        const versaoAtual = form.versao || 1;
        const novaVersao = versaoAtual + 1;
        const numeroBase = (form.numero || '').split('-v')[0];
        const novoNumero = `${numeroBase}-v${novaVersao}`;

        await updateDoc(doc(db, 'orcamentos', docId), {
          somenteLeitura: true,
          updatedAt: serverTimestamp(),
        });

        const { id: _id2, ...formSemId2 } = form as any;
        const novosDados = {
          ...formSemId2, ...calc,
          versao: novaVersao,
          numero: novoNumero,
          status: novaVersao > 1 ? 'alterado' : 'rascunho',
          somenteLeitura: false,
          criadoEm: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'orcamentos'), novosDados);
        toast.success(`Orçamento salvo como ${novoNumero}!`);
        navigate(`/orcamentos/${ref.id}`);
      }
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleGerarPdf = async () => {
    if (!form.nomeCliente?.trim()) { toast.error('Preencha o nome do cliente'); return; }
    if (!form.cnpjCpf?.trim()) { toast.error('CNPJ/CPF é obrigatório'); return; }
    setGerandoPdf(true);
    try {
      // Salva silenciosamente sem navegar
      const calc = calcular(form);
      const docId = form.id || id;
      if (!docId || docId === 'novo') {
        const dados = { ...form, ...calc, versao: 1, status: 'rascunho', somenteLeitura: false, updatedAt: serverTimestamp(), criadoEm: serverTimestamp() };
        const ref = await addDoc(collection(db, 'orcamentos'), dados);
        setForm(prev => ({ ...prev, id: ref.id, ...calc }));
      } else {
        const versaoAtual = form.versao || 1;
        const novaVersao = versaoAtual + 1;
        const numeroBase = (form.numero || '').split('-v')[0];
        const novoNumero = `${numeroBase}-v${novaVersao}`;
        await updateDoc(doc(db, 'orcamentos', docId), { somenteLeitura: true, updatedAt: serverTimestamp() });
        const { id: _id, ...formSemId } = form as any;
        const novosDados = { ...formSemId, ...calc, versao: novaVersao, numero: novoNumero, status: novaVersao > 1 ? 'alterado' : 'rascunho', somenteLeitura: false, criadoEm: serverTimestamp(), updatedAt: serverTimestamp() };
        await addDoc(collection(db, 'orcamentos'), novosDados);
        setSomenteLeitura(true);
      }

      const configSnap = await getDoc(doc(db, 'configuracoes', 'orcamento'));
      const config = configSnap.exists() ? configSnap.data() : {};

      await gerarOrcamentoPdf({
        numero: form.numero || '000-2026',
        nomeCliente: form.nomeCliente || '',
        nomeEvento: form.nomeEvento || '',
        cnpjCpf: form.cnpjCpf || '',
        emailPrincipal: form.emailPrincipal || '',
        telefone: form.telefone || '',
        responsavel: form.responsavel || '',
        localEvento: form.localEvento || '',
        dataEventoInicio: form.dataEventoInicio || '',
        dataEventoFim: form.dataEventoFim || '',
        diarias: form.diarias || 1,
        condicaoPagamento: form.condicaoPagamento || '',
        blocos: (form.blocos || []) as any,
        extras: (form.extras || []) as any,
        despAlimentacao: form.despAlimentacao || 0,
        despTransporte: form.despTransporte || 0,
        despHospedagem: form.despHospedagem || 0,
        despPedagio: form.despPedagio || 0,
        valorCliente: form.valorCliente || 0,
        observacoes: form.observacoes || '',
      }, {
        capaPdfUrl: config.capaPdfUrl || '',
        timbradoPdfUrl: config.timbradoPdfUrl || '',
        nomeEmpresa: config.nomeEmpresa || 'BORNOV',
        telefone: config.telefone || '',
        email: config.email || '',
        site: config.site || '',
      }, primeiroNome(form.nomeCliente || ''));

      toast.success('PDF gerado!');
    } catch (error: any) {
      toast.error(`Erro ao gerar PDF: ${error.message}`);
    } finally {
      setGerandoPdf(false);
    }
  };

  const calcularTotalBloco = (bloco: BlocoServico) => {
    if (bloco.valorManual > 0) return bloco.valorManual;
    const diarias = form.diarias || 1;
    return bloco.itens.reduce((acc, i) => acc + i.valorDia * i.quantidade * diarias, 0);
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  return (
    <div className="space-y-6 pb-20 text-left max-w-5xl">

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/orcamentos')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest mb-3">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-1">Orçamentos</p>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">
            {isNovo ? 'Novo Orçamento' : `Orçamento ${form.numero}`}
          </h1>
          {somenteLeitura && (
            <span className="mt-2 inline-flex items-center px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[9px] font-black uppercase tracking-widest">
              Versão anterior — somente leitura
            </span>
          )}
        </div>
        {!somenteLeitura && (
          <div className="flex gap-2 shrink-0 mt-8">
            <button onClick={handleSalvar} disabled={salvando}
              className="h-10 px-4 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all flex items-center gap-2 disabled:opacity-50">
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
            </button>
            <button onClick={handleGerarPdf} disabled={gerandoPdf}
              className="h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20">
              {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {gerandoPdf ? 'Gerando...' : 'Gerar PDF'}
            </button>
          </div>
        )}
      </header>

      {/* DADOS DO CLIENTE */}
      <div className={cn("bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden", somenteLeitura && "opacity-75 pointer-events-none")}>
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Dados do Cliente</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome do Cliente *</label>
              <input type="text" value={form.nomeCliente || ''} onChange={e => updateForm({ nomeCliente: e.target.value })}
                placeholder="Ex: Irrigacana" readOnly={somenteLeitura}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome do Evento</label>
              <input type="text" value={form.nomeEvento || ''} onChange={e => updateForm({ nomeEvento: e.target.value })}
                placeholder="Ex: 6º Irrigacana 2026" readOnly={somenteLeitura}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">CNPJ / CPF *</label>
              <div className="flex gap-2">
                <input type="text" value={form.cnpjCpf || ''} onChange={e => updateForm({ cnpjCpf: e.target.value })}
                  placeholder="00.000.000/0000-00" readOnly={somenteLeitura}
                  className="flex-1 h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                {isCnpj(form.cnpjCpf || '') && !somenteLeitura && (
                  <button onClick={buscarCnpj} disabled={buscandoCnpj}
                    className="h-11 w-11 shrink-0 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center text-zinc-400 hover:text-[#ff5351] hover:border-[#ff5351] transition-all disabled:opacity-50">
                    {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">E-mail Principal</label>
              <input type="text" value={form.emailPrincipal || ''} onChange={e => updateForm({ emailPrincipal: e.target.value })}
                placeholder="contato@empresa.com" readOnly={somenteLeitura}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Telefone</label>
              <input type="text" value={form.telefone || ''} onChange={e => updateForm({ telefone: e.target.value })}
                placeholder="(00) 00000-0000" readOnly={somenteLeitura}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
          </div>

          <button onClick={() => setDadosExpandidos(!dadosExpandidos)}
            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">
            {dadosExpandidos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {dadosExpandidos ? 'Ocultar dados completos' : '+ Dados completos'}
          </button>

          {dadosExpandidos && (
            <div className="space-y-4 pt-2 border-t border-zinc-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Razão Social</label>
                  <input type="text" value={form.razaoSocial || ''} onChange={e => updateForm({ razaoSocial: e.target.value })}
                    readOnly={somenteLeitura}
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome Comercial</label>
                  <input type="text" value={form.nomeComercial || ''} onChange={e => updateForm({ nomeComercial: e.target.value })}
                    readOnly={somenteLeitura}
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Website</label>
                  <input type="text" value={form.website || ''} onChange={e => updateForm({ website: e.target.value })}
                    readOnly={somenteLeitura}
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Responsável</label>
                  <input type="text" value={form.responsavel || ''} onChange={e => updateForm({ responsavel: e.target.value })}
                    readOnly={somenteLeitura}
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Endereço</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">CEP</label>
                    <input type="text" value={form.cep || ''} onChange={e => updateForm({ cep: e.target.value })}
                      placeholder="00000-000" readOnly={somenteLeitura}
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Endereço</label>
                    <input type="text" value={form.endereco || ''} onChange={e => updateForm({ endereco: e.target.value })}
                      readOnly={somenteLeitura}
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Número</label>
                    <input type="text" value={form.numero_end || ''} onChange={e => updateForm({ numero_end: e.target.value })}
                      readOnly={somenteLeitura}
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Complemento</label>
                    <input type="text" value={form.complemento || ''} onChange={e => updateForm({ complemento: e.target.value })}
                      readOnly={somenteLeitura}
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Bairro</label>
                    <input type="text" value={form.bairro || ''} onChange={e => updateForm({ bairro: e.target.value })}
                      readOnly={somenteLeitura}
                      className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                  </div>
                  <div className="grid grid-cols-[1fr_100px] gap-3">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Cidade</label>
                      <input type="text" value={form.cidade || ''} onChange={e => updateForm({ cidade: e.target.value })}
                        readOnly={somenteLeitura}
                        className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Estado</label>
                      <input type="text" value={form.estado || ''} onChange={e => updateForm({ estado: e.target.value })}
                        placeholder="SP" readOnly={somenteLeitura}
                        className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dados do orçamento */}
          <div className="pt-4 border-t border-zinc-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Dados do Orçamento</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Local do Evento</label>
                <input type="text" value={form.localEvento || ''} onChange={e => updateForm({ localEvento: e.target.value })}
                  placeholder="Ex: Ribeirão Preto/SP" readOnly={somenteLeitura}
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Número de Diárias</label>
                <input type="number" value={form.diarias || 1} min={1}
                  onChange={e => updateForm({ diarias: Number(e.target.value) })}
                  readOnly={somenteLeitura}
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none text-center" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Data Início do Evento</label>
                <input type="date" value={form.dataEventoInicio || ''} onChange={e => updateForm({ dataEventoInicio: e.target.value })}
                  readOnly={somenteLeitura}
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Data Fim do Evento (opcional)</label>
                <input type="date" value={form.dataEventoFim || ''} onChange={e => updateForm({ dataEventoFim: e.target.value })}
                  readOnly={somenteLeitura}
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Condição de Pagamento</label>
                <select value={form.condicaoPagamento || ''} onChange={e => updateForm({ condicaoPagamento: e.target.value })}
                  disabled={somenteLeitura}
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none appearance-none">
                  {CONDICOES_PAGAMENTO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCOS DE SERVIÇO */}
      <div className={cn("space-y-4", somenteLeitura && "opacity-75 pointer-events-none")}>
        {(form.blocos || []).map(bloco => (
          <div key={bloco.id} className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/50">
              <input type="text" value={bloco.nome} onChange={e => updateForm({
                blocos: (form.blocos || []).map(b => b.id === bloco.id ? { ...b, nome: e.target.value } : b)
              })}
                placeholder="Nome do bloco (ex: Cobertura do Evento)"
                readOnly={somenteLeitura}
                className="flex-1 h-9 bg-transparent text-white text-sm font-black uppercase outline-none placeholder:text-zinc-600" />
              {!somenteLeitura && (
                <button onClick={() => removerBloco(bloco.id)} className="p-1.5 text-zinc-500 hover:text-red-400 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Template base</label>
                  <select value={bloco.templateId} onChange={e => carregarTemplate(bloco.id, e.target.value)}
                    disabled={somenteLeitura}
                    className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none appearance-none">
                    <option value="">Sem template (manual)</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Valor manual (R$)</label>
                  <input type="number" value={bloco.valorManual || ''} placeholder="Automático pelo template"
                    readOnly={somenteLeitura}
                    onChange={e => updateForm({
                      blocos: (form.blocos || []).map(b => b.id === bloco.id ? { ...b, valorManual: Number(e.target.value) } : b)
                    })}
                    className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none" />
                </div>
              </div>

              {bloco.itens.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Item</th>
                        <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Total</th>
                        <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {bloco.itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition-all">
                          <td className="px-4 py-2.5 text-white text-sm">
                            {String(item.quantidade).padStart(2, '0')} — {item.nome}
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-400 text-sm">
                            {fmt(item.valorDia * item.quantidade * (form.diarias || 1))}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => toggleTipoItem(bloco.id, idx)}
                              disabled={item.tipo === 'equipe' || somenteLeitura}
                              className={cn(
                                'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all',
                                item.tipo === 'proprio' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer',
                                item.tipo === 'equipe' && 'bg-amber-500/10 text-amber-400 border-amber-500/20 cursor-default',
                                item.tipo === 'locacao' && 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 cursor-pointer',
                              )}>
                              {item.tipo === 'proprio' && '📷 Próprio'}
                              {item.tipo === 'equipe' && '👥 Equipe'}
                              {item.tipo === 'locacao' && '🔧 Locação'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
                    <div className="flex gap-4">
                      {bloco.itens.some(i => i.tipo === 'proprio') && (
                        <span className="text-[10px] font-black text-emerald-400">
                          📷 {fmt(bloco.itens.filter(i => i.tipo === 'proprio').reduce((a, i) => a + i.valorDia * i.quantidade * (form.diarias || 1), 0))}
                        </span>
                      )}
                      {bloco.itens.some(i => i.tipo === 'equipe') && (
                        <span className="text-[10px] font-black text-amber-400">
                          👥 {fmt(bloco.itens.filter(i => i.tipo === 'equipe').reduce((a, i) => a + i.valorDia * i.quantidade * (form.diarias || 1), 0))}
                        </span>
                      )}
                      {bloco.itens.some(i => i.tipo === 'locacao') && (
                        <span className="text-[10px] font-black text-red-400">
                          🔧 {fmt(bloco.itens.filter(i => i.tipo === 'locacao').reduce((a, i) => a + i.valorDia * i.quantidade * (form.diarias || 1), 0))}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-[#ff5351]">
                      Total: {fmt(calcularTotalBloco(bloco))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {!somenteLeitura && (
          <button onClick={adicionarBloco}
            className="w-full h-12 border border-dashed border-zinc-700 rounded-2xl text-zinc-500 hover:text-white hover:border-zinc-500 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar bloco de serviço
          </button>
        )}
      </div>

      {/* DESPESAS + CALCULADORA */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", somenteLeitura && "opacity-75 pointer-events-none")}>
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              Despesas de Deslocamento
              <span className="ml-2 text-zinc-600 font-normal normal-case text-[10px]">— não aparece no PDF</span>
            </h2>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Alimentação', field: 'despAlimentacao' },
              { label: 'Transporte / Km', field: 'despTransporte' },
              { label: 'Hospedagem', field: 'despHospedagem' },
              { label: 'Pedágio / Estacionamento', field: 'despPedagio' },
            ].map(({ label, field }) => (
              <div key={field} className="flex items-center gap-4">
                <label className="text-sm text-zinc-400 min-w-[160px]">{label}</label>
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
                  <input type="number" value={(form as any)[field] || 0}
                    onChange={e => updateForm({ [field]: Number(e.target.value) })}
                    readOnly={somenteLeitura}
                    className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 text-white text-sm focus:border-[#ff5351] outline-none" />
                </div>
              </div>
            ))}
            
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-sm text-zinc-500">Total despesas</span>
              <span className="text-sm font-black text-white">
                {fmt((form.despAlimentacao || 0) + (form.despTransporte || 0) + (form.despHospedagem || 0) + (form.despPedagio || 0))}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              Calculadora Interna
              <span className="ml-2 text-zinc-600 font-normal normal-case text-[10px]">— não aparece no PDF</span>
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-400 min-w-[160px]">% Nota fiscal</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.pctNota || 0} min={0} max={100}
                  onChange={e => updateForm({ pctNota: Number(e.target.value) })}
                  readOnly={somenteLeitura}
                  className="w-20 h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none text-center" />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-400 min-w-[160px]">% Margem adicional</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.pctMargem || 0} min={0}
                  onChange={e => updateForm({ pctMargem: Number(e.target.value) })}
                  readOnly={somenteLeitura}
                  className="w-20 h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none text-center" />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
            </div>
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              {[
                { label: '👥 Equipe/freelance', value: form.totalCustoEquipe || 0, color: 'text-amber-400' },
                { label: '🔧 Locação externa', value: form.totalCustoLocacao || 0, color: 'text-red-400' },
                { label: '🚗 Despesas', value: form.totalCustoDesp || 0, color: 'text-zinc-400' },
                { label: '📄 Nota fiscal', value: form.totalCustoNota || 0, color: 'text-zinc-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className={cn('text-xs', color)}>{label}</span>
                  <span className="text-xs text-zinc-400">{fmt(value)}</span>
                </div>
              ))}
              
              <div className="flex items-center justify-between py-1 border-t border-zinc-800">
                <span className="text-xs font-black text-white">Custo total real</span>
                <span className="text-xs font-black text-white">{fmt(form.totalCustoReal || 0)}</span>
              </div>
              <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
                <span className="text-xs font-black text-emerald-400">📷 Equip. próprios (lucro direto)</span>
                <span className="text-xs font-black text-emerald-400">{fmt(form.totalProprio || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">📈 Margem adicional</span>
                <span className="text-xs text-emerald-400">{fmt(form.totalMargem || 0)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-800">
                <span className="text-sm font-black text-[#ff5351]">Total sugerido</span>
                <span className="text-lg font-black text-[#ff5351]">{fmt(form.totalSugerido || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXTRAS */}
      <div className={cn("bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden", somenteLeitura && "opacity-75 pointer-events-none")}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Extras (aparecem no PDF com valor)</h2>
          {!somenteLeitura && (
            <button onClick={adicionarExtra}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
              <Plus className="w-3 h-3" /> Adicionar extra
            </button>
          )}
        </div>
        <div className="p-5">
          {(form.extras || []).length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-4">Nenhum extra adicionado</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_140px_80px_100px_auto] gap-3 items-center px-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Nome</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Valor / dia</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">Diárias</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Total</span>
                <span></span>
              </div>
              {(form.extras || []).map(extra => (
                <div key={extra.id} className="grid grid-cols-[1fr_140px_80px_100px_auto] gap-3 items-center">
                  <input type="text" value={extra.nome} onChange={e => atualizarExtra(extra.id, 'nome', e.target.value)}
                    placeholder="Nome do extra" readOnly={somenteLeitura}
                    className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none" />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">R$</span>
                    <input type="number" value={extra.valorDia || ''} onChange={e => atualizarExtra(extra.id, 'valorDia', Number(e.target.value))}
                      placeholder="0,00" readOnly={somenteLeitura}
                      className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 text-white text-sm focus:border-[#ff5351] outline-none" />
                  </div>
                  <input type="number" value={extra.diarias || 1} min={1}
                    onChange={e => atualizarExtra(extra.id, 'diarias', Number(e.target.value))}
                    readOnly={somenteLeitura}
                    className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none text-center" />
                  <div className="h-10 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 flex items-center justify-end">
                    <span className="text-emerald-400 text-sm font-black">
                      {fmt((extra.valorDia || 0) * (extra.diarias || 1))}
                    </span>
                  </div>
                  {!somenteLeitura && (
                    <button onClick={() => removerExtra(extra.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total extras</span>
                <span className="text-sm font-black text-white">
                  {fmt((form.extras || []).reduce((acc, e) => acc + (e.valorDia || 0) * (e.diarias || 1), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PROPOSTA FINAL */}
      <div className={cn("bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden", somenteLeitura && "opacity-75 pointer-events-none")}>
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Proposta Final</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            {(form.blocos || []).map(bloco => (
              <div key={bloco.id} className="flex items-center justify-between py-2 border-b border-zinc-800">
                <span className="text-sm font-black text-white uppercase">{bloco.nome || 'Bloco sem nome'}</span>
                <span className="text-sm font-black text-white">{fmt(calcularTotalBloco(bloco))}</span>
              </div>
            ))}
            {(form.extras || []).map(extra => (
              <div key={extra.id} className="flex items-center justify-between py-2 border-b border-zinc-800">
                <span className="text-sm text-zinc-400">{extra.nome || 'Extra'}</span>
                <span className="text-sm text-zinc-400">{fmt((extra.valorDia || 0) * (extra.diarias || 1))}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">
                Valor para o cliente (R$)
              </label>
              <input type="number" value={form.valorCliente || 0}
                onChange={e => {
                  const v = Number(e.target.value);
                  setForm(prev => ({ ...prev, valorCliente: v, lucroReal: v - (prev.totalCustoReal || 0) }));
                }}
                readOnly={somenteLeitura}
                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-2xl font-black focus:border-[#ff5351] outline-none" />
              <p className="text-[10px] text-zinc-600 mt-1">Você pode ajustar o valor sugerido</p>
            </div>
            <div className="flex flex-col justify-center gap-2">
              <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <span className="text-xs text-zinc-500">Lucro real com este valor</span>
                <span className={cn('text-sm font-black', (form.lucroReal || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {fmt(form.lucroReal || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <span className="text-xs text-zinc-500">Condição de pagamento</span>
                <span className="text-xs font-black text-white">{form.condicaoPagamento}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Observações (aparecem no PDF)</label>
            <textarea value={form.observacoes || ''} onChange={e => updateForm({ observacoes: e.target.value })}
              rows={3} placeholder="Ex: Todo o material será entregue via link do Google Drive..."
              readOnly={somenteLeitura}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-[#ff5351] outline-none resize-none" />
          </div>
        </div>
      </div>

      {/* Botões finais */}
      {!somenteLeitura && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button onClick={() => navigate('/orcamentos')}
            className="h-10 px-6 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando}
            className="h-10 px-6 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all flex items-center gap-2 disabled:opacity-50">
            {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
          </button>
          <button onClick={handleGerarPdf} disabled={gerandoPdf}
            className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20">
            {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {gerandoPdf ? 'Gerando...' : 'Gerar PDF'}
          </button>
        </div>
      )}
    </div>
  );
}
