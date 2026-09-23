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
    { id: 'pumps', label: t.pumps },
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

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-solar-muted pointer-events-none`} size={18} />
          <input 
            type="text" 
            placeholder={t.search} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full bg-solar-card border border-solar-border rounded-2xl py-3 text-base sm:text-sm font-bold text-solar-text outline-none transition-all shadow-2xs focus:border-solar-blue min-h-[46px] ${isAr ? 'pr-11 pl-10' : 'pl-11 pr-10'}`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 text-solar-muted hover:text-solar-text rounded-full hover:bg-solar-light transition-colors`}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide -mx-1 px-1 touch-pan-x">
        {categories.map((cat) => (
          <button 
            key={cat.id} 
            onClick={() => setFilter({ ...activeFilter, category: cat.id })}
            className={`whitespace-nowrap px-4 sm:px-6 py-2 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 ${activeFilter.category === cat.id ? 'bg-solar-blue text-white shadow-md shadow-solar-blue/20 ring-2 ring-solar-blue/20' : 'bg-solar-card border border-solar-border text-solar-muted hover:text-solar-text'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-solar-muted uppercase tracking-wider">{t.sortBy}</span>
          <select 
            value={activeFilter.sort}
            onChange={(e) => setFilter({ ...activeFilter, sort: e.target.value as any })}
            className="bg-solar-card text-xs font-black text-solar-text outline-none cursor-pointer border border-solar-border rounded-xl px-2.5 py-1.5 min-h-[36px] shadow-2xs"
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
