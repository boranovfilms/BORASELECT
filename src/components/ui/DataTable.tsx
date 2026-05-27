import React from 'react';
import { cn } from '../../lib/utils';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T extends { id?: string | number }>({ 
  columns, 
  data, 
  loading, 
  emptyMessage = "Nenhum registro encontrado.",
  onRowClick,
  actions
}: DataTableProps<T>) {
  
  return (
    <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={cn(
                    "px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500",
                    col.align === 'center' && "text-center",
                    col.align === 'right' && "text-right",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">
                  Controle
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-zinc-500 italic">
                  Carregando dados...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-zinc-500 italic font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => (
                <tr 
                  key={item.id || rowIdx} 
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "group transition-all duration-300",
                    onRowClick 
                      ? "cursor-pointer hover:bg-[#ff5351]/15" 
                      : "hover:bg-zinc-800/30"
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td 
                      key={colIdx} 
                      className={cn(
                        "px-6 py-3 text-sm transition-colors",
                        col.align === 'center' && "text-center",
                        col.align === 'right' && "text-right",
                        onRowClick && "group-hover:text-white",
                        col.className
                      )}
                    >
                      {typeof col.accessor === 'function' 
                        ? col.accessor(item) 
                        : (item[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actions(item)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
