import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { Save, Loader2, Upload, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConfiguracaoOrcamento {
  nomeEmpresa: string;
  telefone: string;
  email: string;
  site: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  capaPdfUrl: string;
  timbradoPdfUrl: string;
  updatedAt?: any;
}

export default function OrcamentoConfiguracoes() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadandoCapa, setUploadandoCapa] = useState(false);
  const [uploadandoTimbrado, setUploadandoTimbrado] = useState(false);
  const [progressCapa, setProgressCapa] = useState(0);
  const [progressTimbrado, setProgressTimbrado] = useState(0);

  const [form, setForm] = useState<ConfiguracaoOrcamento>({
    nomeEmpresa: 'BORNOV',
    telefone: '',
    email: '',
    site: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    estado: '',
    capaPdfUrl: '',
    timbradoPdfUrl: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracoes', 'orcamento'));
        if (snap.exists()) {
          setForm(snap.data() as ConfiguracaoOrcamento);
        }
      } catch {
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const uploadPdf = async (
    file: File,
    campo: 'capa' | 'timbrado',
    setProgress: (v: number) => void,
    setUploading: (v: boolean) => void
  ) => {
    if (file.type !== 'application/pdf') {
      toast.error('Envie apenas arquivos PDF');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const path = `orcamentos/config/${campo}_${Date.now()}.pdf`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          snapshot => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            if (campo === 'capa') {
              setForm(prev => ({ ...prev, capaPdfUrl: url }));
              await setDoc(doc(db, 'configuracoes', 'orcamento'), { ...form, capaPdfUrl: url, updatedAt: serverTimestamp() }, { merge: true });
            } else {
              setForm(prev => ({ ...prev, timbradoPdfUrl: url }));
              await setDoc(doc(db, 'configuracoes', 'orcamento'), { ...form, timbradoPdfUrl: url, updatedAt: serverTimestamp() }, { merge: true });
            }
            toast.success(`${campo === 'capa' ? 'Capa' : 'Timbrado'} enviado!`);
            resolve();
          }
        );
      });
    } catch {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleSalvar = async () => {
    if (!form.nomeEmpresa?.trim()) { toast.error('Nome da empresa é obrigatório'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'orcamento'), { ...form, updatedAt: serverTimestamp() }, { merge: true });
      toast.success('Configurações salvas!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  return (
    <div className="space-y-8 pb-20 text-left max-w-3xl">
      <header>
        <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Orçamentos</p>
        <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Configurações</h1>
        <p className="text-zinc-500 text-sm mt-1">Dados da empresa e arquivos padrão para geração de PDF</p>
      </header>

      {/* PDFs */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Arquivos Padrão</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Capa */}
          <div className="space-y-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">PDF de Capa</p>
              <p className="text-zinc-600 text-xs">Capa padrão usada em todos os orçamentos</p>
            </div>
            {form.capaPdfUrl ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-emerald-400 text-xs font-black uppercase">Capa cadastrada</p>
                  <a href={form.capaPdfUrl} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-500 text-[10px] hover:text-white transition-all truncate block">
                    Visualizar PDF
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl">
                <p className="text-zinc-600 text-xs text-center">Nenhuma capa cadastrada</p>
              </div>
            )}
            <label className={`w-full h-10 flex items-center justify-center gap-2 rounded-xl font-black uppercase text-[9px] tracking-widest cursor-pointer transition-all border
              ${uploadandoCapa ? 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}>
              {uploadandoCapa ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Enviando {progressCapa}%</>
              ) : (
                <><Upload className="w-3 h-3" /> {form.capaPdfUrl ? 'Substituir capa' : 'Enviar capa PDF'}</>
              )}
              <input type="file" accept="application/pdf" className="hidden" disabled={uploadandoCapa}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadPdf(file, 'capa', setProgressCapa, setUploadandoCapa);
                  e.target.value = '';
                }} />
            </label>
          </div>

          {/* Timbrado */}
          <div className="space-y-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Papel Timbrado</p>
              <p className="text-zinc-600 text-xs">Usado como fundo nas páginas internas do orçamento</p>
            </div>
            {form.timbradoPdfUrl ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-emerald-400 text-xs font-black uppercase">Timbrado cadastrado</p>
                  <a href={form.timbradoPdfUrl} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-500 text-[10px] hover:text-white transition-all truncate block">
                    Visualizar PDF
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl">
                <p className="text-zinc-600 text-xs text-center">Nenhum timbrado cadastrado</p>
              </div>
            )}
            <label className={`w-full h-10 flex items-center justify-center gap-2 rounded-xl font-black uppercase text-[9px] tracking-widest cursor-pointer transition-all border
              ${uploadandoTimbrado ? 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}>
              {uploadandoTimbrado ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Enviando {progressTimbrado}%</>
              ) : (
                <><Upload className="w-3 h-3" /> {form.timbradoPdfUrl ? 'Substituir timbrado' : 'Enviar timbrado PDF'}</>
              )}
              <input type="file" accept="application/pdf" className="hidden" disabled={uploadandoTimbrado}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) uploadPdf(file, 'timbrado', setProgressTimbrado, setUploadandoTimbrado);
                  e.target.value = '';
                }} />
            </label>
          </div>
        </div>
      </div>

      {/* Dados da empresa */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Dados da Empresa</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome da Empresa *</label>
              <input type="text" value={form.nomeEmpresa || ''} onChange={e => setForm(prev => ({ ...prev, nomeEmpresa: e.target.value }))}
                placeholder="BORNOV"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">CNPJ</label>
              <input type="text" value={form.cnpj || ''} onChange={e => setForm(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Telefone</label>
              <input type="text" value={form.telefone || ''} onChange={e => setForm(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(19) 99999-9999"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">E-mail</label>
              <input type="text" value={form.email || ''} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contato@bornov.com.br"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Site</label>
              <input type="text" value={form.site || ''} onChange={e => setForm(prev => ({ ...prev, site: e.target.value }))}
                placeholder="www.bornov.com.br"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Endereço</label>
              <input type="text" value={form.endereco || ''} onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Cidade</label>
                <input type="text" value={form.cidade || ''} onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))}
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Estado</label>
                <input type="text" value={form.estado || ''} onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))}
                  placeholder="SP"
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSalvar} disabled={salvando}
              className="h-10 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20">
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
