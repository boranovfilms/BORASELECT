import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Phone, Globe, Star, TrendingUp, UserPlus, Loader2, AlertCircle, X, ArrowLeft, Edit2, Save, Clock, Calendar, PhoneCall, CheckCircle, XCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

const SEGMENTOS = [
  'Clínicas de estética', 'Clínicas de fisioterapia', 'Clínicas odontológicas',
  'Clínicas médicas', 'Psicólogos e terapeutas', 'Nutricionistas',
  'Clínicas de pilates e yoga', 'Clínicas veterinárias e pet shops',
  'Clínicas de acupuntura', 'Clínicas de dermatologia', 'Clínicas de oftalmologia',
  'Clínicas de ortopedia', 'Laboratórios de análises clínicas',
  'Clínicas de quiropraxia', 'Clínicas de fonoaudiologia',
  'Academias', 'Personal trainers', 'Escolas de artes marciais',
  'Escolas de natação e esportes', 'Crossfit e funcional', 'Estúdios de dança',
  'Campos e quadras esportivas', 'Lojas de artigos esportivos',
  'Salões de beleza', 'Barbearias', 'Clínicas de bronzeamento',
  'Spas e centros de relaxamento', 'Clínicas de micropigmentação',
  'Clínicas de depilação', 'Nail designers e manicures', 'Maquiadoras profissionais',
  'Restaurantes', 'Cafeterias e padarias', 'Delivery e dark kitchens',
  'Buffets e eventos gastronômicos', 'Pizzarias', 'Hamburguerias artesanais',
  'Sorveterias e açaís', 'Empórios e lojas de produtos naturais',
  'Escolas', 'Cursos e treinamentos', 'Faculdades e cursos técnicos',
  'Escolas de idiomas', 'Escolas de música', 'Escolas de teatro e artes',
  'Cursinhos pré-vestibular', 'Escolas de informática',
  'Escritórios de advocacia', 'Contabilidades', 'Consultorias financeiras',
  'Seguradoras e corretoras', 'Escritórios de cobrança',
  'Empresas de crédito e financiamento', 'Consultorias de RH',
  'Escritórios de contabilidade digital',
  'Imobiliárias', 'Construtoras', 'Arquitetos e designers de interiores',
  'Empresas de reformas e manutenção', 'Administradoras de condomínios',
  'Empresas de limpeza e conservação', 'Vidraçarias e esquadrias',
  'Marmorarias e granitos',
  'Concessionárias', 'Oficinas mecânicas', 'Lava-rápidos e estética automotiva',
  'Funilarias e pintura automotiva', 'Lojas de pneus e rodas',
  'Rastreamento e alarmes veiculares', 'Despachantes e documentação',
  'Lojas de roupas e calçados', 'Lojas de móveis e decoração',
  'Farmácias e drogarias', 'Supermercados e mercados', 'Óticas',
  'Joalherias e relojoarias', 'Lojas de eletrônicos', 'Livrarias e papelarias',
  'Hotéis e pousadas', 'Agências de viagem', 'Resorts e spas',
  'Parques e atrações turísticas', 'Hostels e albergues',
  'Locadoras de veículos', 'Guias turísticos', 'Restaurantes temáticos',
  'Cerimoniais e casamentos', 'Fotógrafos e videomakers', 'Produtoras de eventos',
  'DJs e bandas', 'Decoradores de festas', 'Locadoras de equipamentos para eventos',
  'Buffets infantis', 'Espaços para eventos',
  'Empresas de TI e software', 'Gráficas e impressão', 'Agências de publicidade',
  'Empresas de segurança e monitoramento', 'Empresas de logística e transporte',
  'Consultorias de marketing digital',
];

interface Ligacao {
  data: string;
  resultado: 'nao_atendeu' | 'atendeu' | 'numero_errado' | '';
  anotacao: string;
}

interface Lead {
  id?: string;
  placeId: string;
  nome: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  email: string;
  site: string;
  instagram: string;
  cnpj: string;
  porte: string;
  nota: number;
  totalAvaliacoes: number;
  tipo: string;
  score: number;
  classificacao: 'quente' | 'morno' | 'frio';
  status: 'novo' | 'contatado' | 'proposta' | 'reuniao' | 'fechou' | 'nao_fechou';
  segmento: string;
  cidade: string;
  origemBusca: string;
  ligacoes: Ligacao[];
  reuniaoData: string;
  reuniaoHora: string;
  reuniaoFormato: string;
  reuniaoLink: string;
  reuniaoObs: string;
  anotacoes: string;
  historico: { acao: string; data: string }[];
  criadoEm?: any;
  updatedAt?: any;
}

interface HistoricoBusca {
  id?: string;
  segmento: string;
  cidade: string;
  raio: number;
  totalResultados: number;
  resultados: any[];
  criadoEm?: any;
}

const calcularScore = (lead: Partial<Lead>): number => {
  let score = 0;
  if (lead.site) score += 20;
  if (lead.telefone) score += 15;
  if (lead.nota && lead.nota >= 4.5) score += 25;
  else if (lead.nota && lead.nota >= 4.0) score += 15;
  if (lead.totalAvaliacoes && lead.totalAvaliacoes >= 100) score += 30;
  else if (lead.totalAvaliacoes && lead.totalAvaliacoes >= 50) score += 20;
  else if (lead.totalAvaliacoes && lead.totalAvaliacoes >= 10) score += 10;
  return Math.min(score, 100);
};

const getClassificacao = (score: number): 'quente' | 'morno' | 'frio' => {
  if (score >= 80) return 'quente';
  if (score >= 50) return 'morno';
  return 'frio';
};

const RAIOS = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
];

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  novo: { label: '🆕 Novo', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  contatado: { label: '📞 Contatado', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  proposta: { label: '📋 Proposta Enviada', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  reuniao: { label: '📅 Reunião Agendada', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  fechou: { label: '✅ Fechou', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  nao_fechou: { label: '❌ Não Fechou', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const LIMITE_MENSAL = 500;
const MES_KEY = `prospectar_count_${new Date().getFullYear()}_${new Date().getMonth()}`;

export default function Prospectar() {
  const [segmento, setSegmento] = useState('');
  const [cidade, setCidade] = useState('');
  const [raio, setRaio] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [historicoBuscas, setHistoricoBuscas] = useState<HistoricoBusca[]>([]);
  const [leadscrm, setLeadsCrm] = useState<Lead[]>([]);
  const [buscasUsadas, setBuscasUsadas] = useState(0);
  const [abaSelecionada, setAbaSelecionada] = useState<'buscar' | 'historico' | 'leads'>('buscar');
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [editando, setEditando] = useState(false);
  const [leadEditado, setLeadEditado] = useState<Lead | null>(null);
  const [salvandoLead, setSalvandoLead] = useState(false);
  const [convertendo, setConvertendo] = useState(false);

  // Ordenação
  const [ordenacaoHistorico, setOrdenacaoHistorico] = useState<{ campo: string; dir: 'asc' | 'desc' }>({ campo: 'criadoEm', dir: 'desc' });
  const [ordenacaoLeads, setOrdenacaoLeads] = useState<{ campo: string; dir: 'asc' | 'desc' }>({ campo: 'criadoEm', dir: 'desc' });

  // Autocomplete
  const [segmentoSugestoes, setSegmentoSugestoes] = useState<string[]>([]);
  const [showSegmentoSugestoes, setShowSegmentoSugestoes] = useState(false);
  const [cidadeSugestoes, setCidadeSugestoes] = useState<any[]>([]);
  const [showCidadeSugestoes, setShowCidadeSugestoes] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const cidadeTimerRef = useRef<any>(null);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(MES_KEY) || '0');
    setBuscasUsadas(count);
    loadHistorico();
    loadLeadsCrm();
  }, []);

  const loadHistorico = async () => {
    const snap = await getDocs(collection(db, 'prospectHistorico'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as HistoricoBusca[];
    setHistoricoBuscas(data);
  };

  const loadLeadsCrm = async () => {
    const snap = await getDocs(collection(db, 'prospects'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
    setLeadsCrm(data);
  };

  const incrementarContador = () => {
    const novoCount = buscasUsadas + 1;
    setBuscasUsadas(novoCount);
    localStorage.setItem(MES_KEY, String(novoCount));
  };

  const usarMinhaLocalizacao = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização não suportada'); return; }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=pt-BR&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results?.length > 0) {
            setCidade(data.results[0].formatted_address);
            setCoordenadas({ lat: latitude, lng: longitude });
            toast.success('Localização detectada!');
          }
        } catch { toast.error('Erro ao converter localização'); }
        finally { setLoadingGeo(false); }
      },
      () => { toast.error('Permissão negada'); setLoadingGeo(false); }
    );
  };

  const handleSegmentoChange = (value: string) => {
    setSegmento(value);
    if (value.length >= 2) {
      const filtrados = SEGMENTOS.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
      setSegmentoSugestoes(filtrados);
      setShowSegmentoSugestoes(filtrados.length > 0);
    } else setShowSegmentoSugestoes(false);
  };

  const handleCidadeChange = async (value: string) => {
    setCidade(value);
    setCoordenadas(null);
    if (cidadeTimerRef.current) clearTimeout(cidadeTimerRef.current);
    if (value.length < 3) { setShowCidadeSugestoes(false); return; }
    cidadeTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(value)}&types=(cities)&language=pt-BR&components=country:br&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.predictions) { setCidadeSugestoes(data.predictions.slice(0, 6)); setShowCidadeSugestoes(true); }
      } catch { }
    }, 400);
  };

  const buscarEmpresas = async () => {
    if (!segmento.trim() || !cidade.trim()) { toast.error('Preencha o segmento e a cidade'); return; }
    if (buscasUsadas >= LIMITE_MENSAL) { toast.error('Limite mensal atingido!'); return; }

    setLoading(true);
    setLeads([]);
    setShowSegmentoSugestoes(false);
    setShowCidadeSugestoes(false);

    try {
      let lat, lng;
      if (coordenadas) {
        lat = coordenadas.lat; lng = coordenadas.lng;
      } else {
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cidade)}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`);
        const geoData = await geoRes.json();
        if (!geoData.results?.length) { toast.error('Cidade não encontrada'); setLoading(false); return; }
        lat = geoData.results[0].geometry.location.lat;
        lng = geoData.results[0].geometry.location.lng;
      }

      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName'
        },
        body: JSON.stringify({
          textQuery: `${segmento} em ${cidade}`,
          locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: raio } },
          maxResultCount: 20,
          languageCode: 'pt-BR'
        })
      });

      const placesData = await placesRes.json();
      incrementarContador();

      if (!placesData.places?.length) { toast('Nenhuma empresa encontrada.'); setLoading(false); return; }

      const resultados: Lead[] = placesData.places.map((place: any) => {
        const lp = {
          placeId: place.id,
          nome: place.displayName?.text || 'Sem nome',
          endereco: place.formattedAddress || '',
          telefone: place.nationalPhoneNumber || '',
          whatsapp: '', email: '', site: place.websiteUri || '',
          instagram: '', cnpj: '', porte: '',
          nota: place.rating || 0,
          totalAvaliacoes: place.userRatingCount || 0,
          tipo: place.primaryTypeDisplayName?.text || '',
          segmento, cidade, origemBusca: `${segmento} em ${cidade}`,
          status: 'novo' as const,
          ligacoes: [{ data: '', resultado: '' as const, anotacao: '' }, { data: '', resultado: '' as const, anotacao: '' }, { data: '', resultado: '' as const, anotacao: '' }],
          reuniaoData: '', reuniaoHora: '', reuniaoFormato: '', reuniaoLink: '', reuniaoObs: '',
          anotacoes: '', historico: [],
        };
        const score = calcularScore(lp);
        return { ...lp, score, classificacao: getClassificacao(score) };
      });

      resultados.sort((a, b) => b.score - a.score);
      setLeads(resultados);

      // Salva no histórico automaticamente
      await addDoc(collection(db, 'prospectHistorico'), {
        segmento, cidade, raio,
        totalResultados: resultados.length,
        resultados: resultados.map(r => ({ placeId: r.placeId, nome: r.nome, endereco: r.endereco, telefone: r.telefone, site: r.site, nota: r.nota, totalAvaliacoes: r.totalAvaliacoes, tipo: r.tipo, score: r.score, classificacao: r.classificacao })),
        criadoEm: serverTimestamp()
      });
      await loadHistorico();

      toast.success(`${resultados.length} empresas encontradas!`);
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao buscar empresas.');
    } finally { setLoading(false); }
  };

  const adicionarComoLead = async (empresa: any) => {
    try {
      const existente = leadscrm.find(l => l.placeId === empresa.placeId);
      if (existente) { toast('Empresa já é um lead!'); return; }
      const novoLead: Lead = {
        ...empresa,
        whatsapp: empresa.whatsapp || '',
        email: empresa.email || '',
        instagram: empresa.instagram || '',
        cnpj: empresa.cnpj || '',
        porte: empresa.porte || '',
        status: 'novo',
        ligacoes: [
          { data: '', resultado: '', anotacao: '' },
          { data: '', resultado: '', anotacao: '' },
          { data: '', resultado: '', anotacao: '' },
        ],
        reuniaoData: '', reuniaoHora: '', reuniaoFormato: 'online', reuniaoLink: '', reuniaoObs: '',
        anotacoes: '',
        historico: [{ acao: 'Lead adicionado ao CRM', data: new Date().toISOString() }],
        criadoEm: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'prospects'), novoLead);
      toast.success('Lead adicionado ao CRM!');
      await loadLeadsCrm();
    } catch { toast.error('Erro ao adicionar lead'); }
  };

  const abrirLead = (lead: Lead) => {
    setLeadSelecionado(lead);
    setLeadEditado({ ...lead });
    setEditando(false);
  };

  const salvarLead = async () => {
    if (!leadEditado?.id) return;
    setSalvandoLead(true);
    try {
      const { id, ...data } = leadEditado;
      await updateDoc(doc(db, 'prospects', id), { ...data, updatedAt: serverTimestamp() });
      toast.success('Lead salvo!');
      await loadLeadsCrm();
      setLeadSelecionado(leadEditado);
      setEditando(false);
    } catch { toast.error('Erro ao salvar'); }
    finally { setSalvandoLead(false); }
  };

  const registrarLigacao = async (index: number) => {
    if (!leadEditado) return;
    const novasLigacoes = [...(leadEditado.ligacoes || [{ data: '', resultado: '', anotacao: '' }, { data: '', resultado: '', anotacao: '' }, { data: '', resultado: '', anotacao: '' }])];
    novasLigacoes[index] = { ...novasLigacoes[index], data: new Date().toISOString() };
    const novoHistorico = [...(leadEditado.historico || []), { acao: `Tentativa de ligação ${index + 1} registrada`, data: new Date().toISOString() }];
    const updated = { ...leadEditado, ligacoes: novasLigacoes, historico: novoHistorico };
    setLeadEditado(updated);
    if (leadEditado.id) {
      await updateDoc(doc(db, 'prospects', leadEditado.id), { ligacoes: novasLigacoes, historico: novoHistorico, updatedAt: serverTimestamp() });
      await loadLeadsCrm();
    }
    toast.success(`Ligação ${index + 1} registrada!`);
  };

  const mudarStatus = async (novoStatus: string) => {
    if (!leadEditado?.id) return;
    const novoHistorico = [...(leadEditado.historico || []), { acao: `Status alterado para: ${STATUS_CONFIG[novoStatus]?.label}`, data: new Date().toISOString() }];
    const updated = { ...leadEditado, status: novoStatus as Lead['status'], historico: novoHistorico };
    setLeadEditado(updated);
    await updateDoc(doc(db, 'prospects', leadEditado.id), { status: novoStatus, historico: novoHistorico, updatedAt: serverTimestamp() });
    await loadLeadsCrm();
    toast.success('Status atualizado!');
  };

  const converterEmCliente = async () => {
    if (!leadEditado?.id) return;
    setConvertendo(true);
    try {
      await addDoc(collection(db, 'clientes'), {
        name: leadEditado.nome,
        commercialName: leadEditado.nome,
        email: leadEditado.email || '',
        phone: leadEditado.telefone || '',
        website: leadEditado.site || '',
        address: leadEditado.endereco || '',
        role: 'cliente',
        status: 'confirmed',
        type: 'empresa',
        createdAt: serverTimestamp(),
        updatedAt: new Date().toISOString(),
        originLead: leadEditado.placeId,
      });
      const novoHistorico = [...(leadEditado.historico || []), { acao: 'Convertido em cliente!', data: new Date().toISOString() }];
      await updateDoc(doc(db, 'prospects', leadEditado.id), { status: 'fechou', historico: novoHistorico, updatedAt: serverTimestamp() });
      toast.success(`${leadEditado.nome} convertido em cliente!`);
      await loadLeadsCrm();
      setLeadSelecionado(null);
    } catch { toast.error('Erro ao converter'); }
    finally { setConvertendo(false); }
  };

  const ordenar = <T extends Record<string, any>>(lista: T[], campo: string, dir: 'asc' | 'desc'): T[] => {
    return [...lista].sort((a, b) => {
      let va = a[campo] || '';
      let vb = b[campo] || '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const toggleOrdenacao = (tipo: 'historico' | 'leads', campo: string) => {
    if (tipo === 'historico') {
      setOrdenacaoHistorico(prev => ({ campo, dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc' }));
    } else {
      setOrdenacaoLeads(prev => ({ campo, dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }
  };

  const SortIcon = ({ campo, tipo }: { campo: string; tipo: 'historico' | 'leads' }) => {
    const ord = tipo === 'historico' ? ordenacaoHistorico : ordenacaoLeads;
    if (ord.campo !== campo) return <ChevronUp className="w-3 h-3 text-zinc-700" />;
    return ord.dir === 'asc' ? <ChevronUp className="w-3 h-3 text-[#ff5351]" /> : <ChevronDown className="w-3 h-3 text-[#ff5351]" />;
  };

  const getClassificacaoConfig = (c: string) => {
    const configs: any = {
      quente: { label: '🔥 Quente', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      morno: { label: '⚡ Morno', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      frio: { label: '❄️ Frio', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    };
    return configs[c] || configs.frio;
  };

  const pctBuscas = Math.round((buscasUsadas / LIMITE_MENSAL) * 100);
  const historicoOrdenado = ordenar(historicoBuscas, ordenacaoHistorico.campo, ordenacaoHistorico.dir);
  const leadsOrdenados = ordenar(leadscrm, ordenacaoLeads.campo, ordenacaoLeads.dir);

  // TELA DE DETALHE DO LEAD
  if (leadSelecionado && leadEditado) {
    return (
      <div className="space-y-6 pb-20 text-left">
        <header className="space-y-3">
          <button onClick={() => setLeadSelecionado(null)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" /> Voltar para Leads
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-1">CRM de Prospecção</p>
              <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">{leadSelecionado.nome}</h1>
              <p className="text-zinc-500 text-sm mt-1">{leadSelecionado.segmento} • {leadSelecionado.cidade}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {editando ? (
                <>
                  <button onClick={() => { setEditando(false); setLeadEditado({ ...leadSelecionado }); }}
                    className="h-9 px-4 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
                    Cancelar
                  </button>
                  <button onClick={salvarLead} disabled={salvandoLead}
                    className="h-9 px-4 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-1 disabled:opacity-50">
                    {salvandoLead ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                  </button>
                </>
              ) : (
                <button onClick={() => setEditando(true)}
                  className="h-9 px-4 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* DADOS DA EMPRESA */}
          <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Dados da Empresa</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Nome', field: 'nome' },
                { label: 'Segmento', field: 'segmento' },
                { label: 'Endereço', field: 'endereco' },
                { label: 'Telefone', field: 'telefone' },
                { label: 'WhatsApp', field: 'whatsapp' },
                { label: 'E-mail', field: 'email' },
                { label: 'Site', field: 'site' },
                { label: 'Instagram', field: 'instagram' },
                { label: 'CNPJ', field: 'cnpj' },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">{label}</label>
                  {editando ? (
                    <input type="text" value={(leadEditado as any)[field] || ''} onChange={e => setLeadEditado({ ...leadEditado, [field]: e.target.value })}
                      className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none" />
                  ) : (
                    <p className="text-white text-xs">{(leadSelecionado as any)[field] || <span className="text-zinc-600">—</span>}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Porte</label>
                {editando ? (
                  <select value={leadEditado.porte || ''} onChange={e => setLeadEditado({ ...leadEditado, porte: e.target.value })}
                    className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none appearance-none">
                    <option value="">Selecionar...</option>
                    <option value="MEI">MEI</option>
                    <option value="Pequena">Pequena</option>
                    <option value="Média">Média</option>
                    <option value="Grande">Grande</option>
                  </select>
                ) : (
                  <p className="text-white text-xs">{leadSelecionado.porte || <span className="text-zinc-600">—</span>}</p>
                )}
              </div>
            </div>
          </div>

          {/* FUNIL DE STATUS */}
          <div className="space-y-6">
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
              <div className="p-5 border-b border-zinc-800">
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Funil de Status</h2>
              </div>
              <div className="p-5 grid grid-cols-2 gap-2">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <button key={key} onClick={() => mudarStatus(key)}
                    className={cn('h-10 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all',
                      leadEditado.status === key ? config.class + ' ring-2 ring-offset-1 ring-offset-[#1f1f1f]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600')}>
                    {config.label}
                  </button>
                ))}
              </div>
              {leadEditado.status === 'fechou' && (
                <div className="px-5 pb-5">
                  <button onClick={converterEmCliente} disabled={convertendo}
                    className="w-full h-11 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {convertendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Converter em Cliente
                  </button>
                </div>
              )}
            </div>

            {/* SCORE */}
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] p-5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Score do Lead</p>
                <p className="text-3xl font-black text-[#ff5351]">{leadSelecionado.score} pts</p>
              </div>
              <span className={cn('px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest', getClassificacaoConfig(leadSelecionado.classificacao).class)}>
                {getClassificacaoConfig(leadSelecionado.classificacao).label}
              </span>
            </div>
          </div>
        </div>

        {/* 3 TENTATIVAS DE LIGAÇÃO */}
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Tentativas de Ligação</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => {
              const ligacao = leadEditado.ligacoes?.[i] || { data: '', resultado: '', anotacao: '' };
              return (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tentativa {i + 1}</p>
                    {!ligacao.data ? (
                      <button onClick={() => registrarLigacao(i)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#ff5351] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                        <PhoneCall className="w-3 h-3" /> Registrar
                      </button>
                    ) : (
                      <span className="text-emerald-400 text-[9px] font-black uppercase">✓ Registrada</span>
                    )}
                  </div>
                  {ligacao.data && (
                    <div className="flex items-center gap-1 text-zinc-500 text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ligacao.data))}
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Resultado</label>
                    <select value={ligacao.resultado || ''} onChange={e => {
                      const novas = [...(leadEditado.ligacoes || [])];
                      novas[i] = { ...novas[i], resultado: e.target.value as any };
                      setLeadEditado({ ...leadEditado, ligacoes: novas });
                    }}
                      className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-white text-[10px] focus:border-[#ff5351] outline-none appearance-none">
                      <option value="">Selecionar...</option>
                      <option value="nao_atendeu">Não atendeu</option>
                      <option value="atendeu">Atendeu</option>
                      <option value="numero_errado">Número errado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Anotação</label>
                    <textarea value={ligacao.anotacao || ''} onChange={e => {
                      const novas = [...(leadEditado.ligacoes || [])];
                      novas[i] = { ...novas[i], anotacao: e.target.value };
                      setLeadEditado({ ...leadEditado, ligacoes: novas });
                    }}
                      rows={2} placeholder="Observações..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-[10px] focus:border-[#ff5351] outline-none resize-none" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AGENDAMENTO */}
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Agendamento de Reunião</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Data</label>
              <input type="date" value={leadEditado.reuniaoData || ''} onChange={e => setLeadEditado({ ...leadEditado, reuniaoData: e.target.value })}
                className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Hora</label>
              <input type="time" value={leadEditado.reuniaoHora || ''} onChange={e => setLeadEditado({ ...leadEditado, reuniaoHora: e.target.value })}
                className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Formato</label>
              <select value={leadEditado.reuniaoFormato || ''} onChange={e => setLeadEditado({ ...leadEditado, reuniaoFormato: e.target.value })}
                className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none appearance-none">
                <option value="">Selecionar...</option>
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
                <option value="telefone">Telefone</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Link (Zoom/Meet)</label>
              <input type="text" value={leadEditado.reuniaoLink || ''} onChange={e => setLeadEditado({ ...leadEditado, reuniaoLink: e.target.value })}
                placeholder="https://meet.google.com/..."
                className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Observações</label>
              <textarea value={leadEditado.reuniaoObs || ''} onChange={e => setLeadEditado({ ...leadEditado, reuniaoObs: e.target.value })}
                rows={2} placeholder="Detalhes da reunião..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:border-[#ff5351] outline-none resize-none" />
            </div>
          </div>
          {leadEditado.reuniaoData && (
            <div className="px-5 pb-5">
              <button onClick={salvarLead} disabled={salvandoLead}
                className="h-9 px-6 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-1 disabled:opacity-50">
                {salvandoLead ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar Reunião
              </button>
            </div>
          )}
        </div>

        {/* ANOTAÇÕES */}
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Anotações</h2>
          </div>
          <div className="p-5">
            <textarea value={leadEditado.anotacoes || ''} onChange={e => setLeadEditado({ ...leadEditado, anotacoes: e.target.value })}
              rows={4} placeholder="Anotações livres sobre este lead..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-[#ff5351] outline-none resize-none" />
            <button onClick={salvarLead} disabled={salvandoLead}
              className="mt-3 h-9 px-6 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all flex items-center gap-1 disabled:opacity-50">
              {salvandoLead ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
            </button>
          </div>
        </div>

        {/* HISTÓRICO TIMELINE */}
        {leadSelecionado.historico && leadSelecionado.historico.length > 0 && (
          <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Histórico</h2>
            </div>
            <div className="p-5 space-y-3">
              {[...leadSelecionado.historico].reverse().map((h, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-[#ff5351] shrink-0 mt-1.5" />
                  <div>
                    <p className="text-white text-xs font-bold">{h.acao}</p>
                    <p className="text-zinc-500 text-[10px] flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(h.data))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // TELA PRINCIPAL
  return (
    <div className="space-y-8 pb-20 text-left">
      <header>
        <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Módulo de Crescimento</p>
        <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Prospectar</h1>
        <p className="text-zinc-500 text-sm mt-1">Encontre e qualifique novos clientes potenciais</p>
      </header>

      {/* Contador */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Buscas utilizadas este mês</span>
          <span className={cn('text-xs font-black', pctBuscas >= 80 ? 'text-red-400' : pctBuscas >= 50 ? 'text-amber-400' : 'text-emerald-400')}>
            {buscasUsadas}/{LIMITE_MENSAL}
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', pctBuscas >= 80 ? 'bg-red-500' : pctBuscas >= 50 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${pctBuscas}%` }} />
        </div>
        {pctBuscas >= 80 && (
          <div className="flex items-center gap-2 mt-2">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-red-400 text-[10px] font-black uppercase">Atenção: limite próximo!</span>
          </div>
        )}
      </div>

      {/* Formulário */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Nova Busca</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Segmento / Nicho</label>
              <input type="text" value={segmento} onChange={e => handleSegmentoChange(e.target.value)}
                onFocus={() => segmento.length >= 2 && setShowSegmentoSugestoes(true)}
                onBlur={() => setTimeout(() => setShowSegmentoSugestoes(false), 200)}
                placeholder="Ex: clínicas de estética..."
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
              {segmento && (
                <button onClick={() => { setSegmento(''); setShowSegmentoSugestoes(false); }}
                  className="absolute right-3 top-[38px] text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
              )}
              {showSegmentoSugestoes && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-y-auto z-50 shadow-xl" style={{ maxHeight: '240px' }}>
                  {segmentoSugestoes.map(s => (
                    <button key={s} onMouseDown={() => { setSegmento(s); setShowSegmentoSugestoes(false); }}
                      className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all border-b border-zinc-800 last:border-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Cidade / Localização</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type="text" value={cidade} onChange={e => handleCidadeChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowCidadeSugestoes(false), 200)}
                    placeholder="Ex: São Paulo, SP"
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
                  {cidade && (
                    <button onClick={() => { setCidade(''); setShowCidadeSugestoes(false); setCoordenadas(null); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
                  )}
                  {showCidadeSugestoes && cidadeSugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden z-50 shadow-xl">
                      {cidadeSugestoes.map(s => (
                        <button key={s.place_id} onMouseDown={() => { setCidade(s.description); setShowCidadeSugestoes(false); }}
                          className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all border-b border-zinc-800 last:border-0 flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />{s.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={usarMinhaLocalizacao} disabled={loadingGeo} title="Usar minha localização"
                  className="h-11 w-11 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-[#ff5351] hover:border-[#ff5351] transition-all disabled:opacity-50">
                  {loadingGeo ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                </button>
              </div>
              {coordenadas && (
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mt-1.5">📍 Localização detectada</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Raio de Busca</label>
            <div className="flex gap-2">
              {RAIOS.map(r => (
                <button key={r.value} onClick={() => setRaio(r.value)}
                  className={cn('flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                    raio === r.value ? 'bg-[#ff5351] text-white border-[#ff5351]' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={buscarEmpresas} disabled={loading || buscasUsadas >= LIMITE_MENSAL}
            className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? 'Buscando empresas...' : 'Buscar Empresas'}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        {[
          { key: 'buscar', label: `Resultados${leads.length > 0 ? ` (${leads.length})` : ''}` },
          { key: 'historico', label: `Histórico${historicoBuscas.length > 0 ? ` (${historicoBuscas.length})` : ''}` },
          { key: 'leads', label: `Leads${leadscrm.length > 0 ? ` (${leadscrm.length})` : ''}` },
        ].map(aba => (
          <button key={aba.key} onClick={() => setAbaSelecionada(aba.key as any)}
            className={cn('px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
              abaSelecionada === aba.key ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white')}>
            {aba.label}
          </button>
        ))}
      </div>

      {/* ABA RESULTADOS */}
      {abaSelecionada === 'buscar' && (
        <div>
          {leads.length === 0 && !loading && (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Faça uma busca para encontrar leads</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map(lead => (
              <div key={lead.placeId} className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 space-y-4 hover:border-zinc-700 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black uppercase text-sm line-clamp-1">{lead.nome}</h3>
                    {lead.tipo && <p className="text-zinc-500 text-[10px] uppercase mt-0.5">{lead.tipo}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', getClassificacaoConfig(lead.classificacao).class)}>
                      {getClassificacaoConfig(lead.classificacao).label}
                    </span>
                    <span className="text-[10px] font-black text-[#ff5351]">{lead.score} pts</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {lead.endereco && <div className="flex items-start gap-2 text-zinc-400 text-xs"><MapPin className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" /><span className="line-clamp-1">{lead.endereco}</span></div>}
                  {lead.telefone && <div className="flex items-center gap-2 text-zinc-400 text-xs"><Phone className="w-3 h-3 shrink-0 text-zinc-600" /><span>{lead.telefone}</span></div>}
                  {lead.site && <div className="flex items-center gap-2 text-xs"><Globe className="w-3 h-3 shrink-0 text-zinc-600" /><a href={lead.site} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">{lead.site.replace('https://', '').replace('http://', '')}</a></div>}
                  {lead.nota > 0 && <div className="flex items-center gap-2 text-xs text-zinc-400"><Star className="w-3 h-3 shrink-0 text-amber-400" /><span><span className="text-amber-400 font-bold">{lead.nota.toFixed(1)}</span> ({lead.totalAvaliacoes} avaliações)</span></div>}
                </div>
                <button onClick={() => adicionarComoLead(lead)}
                  className="w-full h-8 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-1">
                  <UserPlus className="w-3 h-3" /> Adicionar como Lead
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* ABA HISTÓRICO */}
      {abaSelecionada === 'historico' && (
        <div>
          {historicoBuscas.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Nenhuma busca realizada ainda</p>
            </div>
          ) : (
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-widest text-white">
                  {historicoBuscas.reduce((acc, b) => acc + (b.resultados?.length || 0), 0)} empresas encontradas
                </h2>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    {[
                      { label: 'Nome', campo: 'nome' },
                      { label: 'Nicho', campo: 'segmento' },
                      { label: 'Cidade', campo: 'cidade' },
                      { label: 'Score', campo: 'score' },
                      { label: 'Telefone', campo: 'telefone' },
                      { label: 'Site', campo: 'site' },
                    ].map(col => (
                      <th key={col.campo} onClick={() => toggleOrdenacao('historico', col.campo)}
                        className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-all">
                        <div className="flex items-center gap-1">{col.label}<SortIcon campo={col.campo} tipo="historico" /></div>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {ordenar(
                    historicoBuscas.flatMap(busca =>
                      (busca.resultados || []).map((r: any) => ({
                        ...r,
                        segmento: busca.segmento,
                        cidade: busca.cidade,
                      }))
                    ),
                    ordenacaoHistorico.campo,
                    ordenacaoHistorico.dir
                  ).map((empresa: any, i: number) => (
                    <tr key={`${empresa.placeId}-${i}`} className="hover:bg-zinc-800/30 transition-all">
                      <td className="px-5 py-4">
                        <p className="text-white text-sm font-black uppercase line-clamp-1">{empresa.nome}</p>
                      </td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{empresa.segmento}</td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{empresa.cidade}</td>
                      <td className="px-5 py-4">
                        <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', getClassificacaoConfig(empresa.classificacao).class)}>
                          {empresa.score} pts
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{empresa.telefone || '—'}</td>
                      <td className="px-5 py-4 text-xs">
                        {empresa.site ? (
                          <a href={empresa.site} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 truncate max-w-[120px] block transition-colors">
                            {empresa.site.replace('https://', '').replace('http://', '')}
                          </a>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <button onClick={() => adicionarComoLead(empresa)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#ff5351] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                          <UserPlus className="w-2.5 h-2.5" /> Lead
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA LEADS CRM */}
      {abaSelecionada === 'leads' && (
        <div>
          {leadscrm.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Nenhum lead adicionado ainda</p>
            </div>
          ) : (
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    {[
                      { label: 'Nome', campo: 'nome' },
                      { label: 'Nicho', campo: 'segmento' },
                      { label: 'Telefone', campo: 'telefone' },
                      { label: 'Score', campo: 'score' },
                      { label: 'Status', campo: 'status' },
                    ].map(col => (
                      <th key={col.campo} onClick={() => toggleOrdenacao('leads', col.campo)}
                        className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-white transition-all">
                        <div className="flex items-center gap-1">{col.label}<SortIcon campo={col.campo} tipo="leads" /></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {leadsOrdenados.map(lead => (
                    <tr key={lead.id} onClick={() => abrirLead(lead)}
                      className="hover:bg-zinc-800/30 transition-all cursor-pointer">
                      <td className="px-5 py-4">
                        <p className="text-white text-sm font-black uppercase line-clamp-1">{lead.nome}</p>
                        <p className="text-zinc-500 text-[10px]">{lead.cidade}</p>
                      </td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{lead.segmento}</td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{lead.telefone || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', getClassificacaoConfig(lead.classificacao).class)}>
                          {lead.score} pts
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', STATUS_CONFIG[lead.status]?.class || '')}>
                          {STATUS_CONFIG[lead.status]?.label || lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
