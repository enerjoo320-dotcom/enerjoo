import React from 'react';
import { Search, Sparkles, X, User } from 'lucide-react';
import { Category, Filters } from '../types';
import { translations } from '../translations';

interface FilterBarProps {
  lang: 'ar' | 'en';
  activeFilter: Filters;
  setFilter: (filter: Filters) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  useAiSearch: boolean;
  setUseAiSearch: (val: boolean) => void;
  supplierFilterId?: string | number | null;
  onClearSupplierFilter?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  lang, activeFilter, setFilter, searchTerm, setSearchTerm, useAiSearch, setUseAiSearch,
  supplierFilterId, onClearSupplierFilter
}) => {
  const t = translations[lang];
  const isAr = lang === 'ar';

  const categories: { id: Category; label: string }[] = [
    { id: 'all', label: t.all },
    { id: 'panels', label: t.panels },
    { id: 'inverters', label: t.inverters },
    { id: 'batteries', label: t.batteries },
    { id: 'mounting', label: t.mounting },
    { id: 'protection', label: t.protection },
    { id: 'combiner', label: t.combiner },
    { id: 'cables', label: t.cables },
    { id: 'mc4', label: t.mc4 },
    { id: 'sealings', label: t.sealings },
    { id: 'clamps', label: t.clamps }
  ];

  return (
    <div className="space-y-4 mb-6">
      {supplierFilterId && (
        <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
          <div className="bg-solar-blue/10 border border-solar-blue/20 text-solar-blue px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
            <User size={14} className="opacity-70" />
            <span className="text-xs font-black uppercase tracking-tighter">
              {t.filteredBySupplier}
            </span>
            <button 
              onClick={onClearSupplierFilter}
              className="ml-2 p-1 hover:bg-solar-blue/20 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
          <input 
            type="text" 
            placeholder={t.search} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-solar-card border border-solar-border rounded-2xl py-3 pl-[44px] pr-4 outline-none transition-all shadow-sm font-bold text-sm focus:border-solar-blue focus:ring-2/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button 
            key={cat.id} 
            onClick={() => setFilter({ ...activeFilter, category: cat.id })}
            className={`whitespace-nowrap px-6 py-2 rounded-xl text-xs font-black transition-all ${activeFilter.category === cat.id ? 'bg-solar-blue text-white shadow-lg shadow-solar-blue/20 ring-4 ring-solar-blue/10 scale-105' : 'bg-solar-card border border-solar-border text-solar-muted hover:text-solar-text'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-solar-muted uppercase tracking-widest">{t.sortBy}</span>
          <select 
            value={activeFilter.sort}
            onChange={(e) => setFilter({ ...activeFilter, sort: e.target.value as any })}
            className="bg-transparent text-xs font-black text-solar-text outline-none cursor-pointer border border-solar-border rounded-lg px-2 py-1"
          >
            <option value="power">{t.highestPower}</option>
            <option value="price">{t.lowestPrice}</option>
            <option value="efficiency">{t.bestEfficiency}</option>
          </select>
        </div>
      </div>
    </div>
  );
};
