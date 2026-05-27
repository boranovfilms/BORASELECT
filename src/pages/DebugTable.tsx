import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { DataTable } from '../components/ui/DataTable';
import { Database, Search, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DebugTable() {
  const [selectedCollection, setSelectedCollection] = useState('clients');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  const collections = [
    { id: 'clients', label: 'Usuários e Clientes' },
    { id: 'projects', label: 'Projetos' },
    { id: 'tasks', label: 'Tarefas' },
    { id: 'permissions', label: 'Matriz de Permissões' },
    { id: 'workflowModels', label: 'Modelos de Fluxo' },
    { id: 'creditRequests', label: 'Solicitações de Crédito' }
  ];

  useEffect(() => {
    fetchData();
  }, [selectedCollection]);

  const fetchData = async () => {
    setLoading(true);
    setCopied(false);
    try {
      const q = query(collection(db, selectedCollection), limit(100));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (docs.length > 0) {
        const allKeys = new Set<string>();
        docs.forEach(doc => Object.keys(doc).forEach(key => allKeys.add(key)));
        
        const dynamicCols = Array.from(allKeys).map(key => ({
          header: key.toUpperCase(),
          accessor: (item: any) => {
            const val = item[key];
            if (val === undefined || val === null) return '-';
            if (typeof val === 'object') return JSON.stringify(val).substring(0, 30) + '...';
            return String(val);
          }
        }));
        setColumns(dynamicCols);
      } else {
        setColumns([]);
      }
      
      setData(docs);
    } catch (error) {
      toast.error('Erro ao buscar dados da coleção');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (data.length === 0) {
      toast.error('Não há dados para copiar');
      return;
    }
    
    try {
      const jsonString = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success('Dados copiados para a área de transferência!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Falha ao copiar dados');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase italic flex items-center gap-3">
            <Database className="w-8 h-8 text-[#ff5351]" />
            Diagnóstico de Dados
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Auditoria técnica dos registros brutos do Firebase.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={copyToClipboard}
            className={cn(
              "h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl",
              copied ? "bg-emerald-500 text-white" : "bg-white text-black hover:bg-[#ff5351] hover:text-white"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar JSON para Auditoria'}
          </button>
          
          <button onClick={fetchData} className="h-12 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all flex items-center gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap gap-2 pb-4 border-b border-zinc-800/50">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => setSelectedCollection(col.id)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                selectedCollection === col.id 
                ? 'bg-[#ff5351]/10 border-[#ff5351] text-[#ff5351]' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-300'
              )}
            >
              {col.label}
            </button>
          ))}
        </div>

        {data.length > 0 ? (
          <DataTable 
            columns={columns} 
            data={data} 
            loading={loading}
            emptyMessage="Nenhum dado encontrado nesta coleção."
          />
        ) : (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl">
            <Search className="w-12 h-12 text-zinc-900 mx-auto mb-4" />
            <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">
              {loading ? 'Carregando banco de dados...' : 'Selecione uma coleção ou aguarde'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { cn } from '../lib/utils';
