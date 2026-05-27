import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { DataTable } from '../components/ui/DataTable';
import { Database, Search, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DebugTable() {
  const [selectedCollection, setSelectedCollection] = useState('clients');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<any[]>([]);

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
    try {
      const q = query(collection(db, selectedCollection), limit(50));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (docs.length > 0) {
        // Extrai as chaves do primeiro documento para criar as colunas dinamicamente
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

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase italic flex items-center gap-3">
            <Database className="w-8 h-8 text-[#ff5351]" />
            Diagnóstico de Dados
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Visualize os registros brutos salvos no banco de dados.</p>
        </div>
      </header>

      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap gap-3">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => setSelectedCollection(col.id)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                selectedCollection === col.id 
                ? 'bg-[#ff5351] border-[#ff5351] text-white shadow-lg' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'
              }`}
            >
              {col.label}
            </button>
          ))}
          <button onClick={fetchData} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white ml-auto transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
            <Search className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500 font-bold uppercase text-xs">Selecione uma coleção ou aguarde o carregamento</p>
          </div>
        )}
      </div>
    </div>
  );
}
