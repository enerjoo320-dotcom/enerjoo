import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { AdvancedFilters } from '../types';
import { translations } from '../translations';

interface AdvancedSearchPanelProps {
  lang: 'ar' | 'en';
  filters: AdvancedFilters;
  setFilters: (filters: AdvancedFilters) => void;
  onClear: () => void;
}

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({ lang, filters, setFilters, onClear }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const t = translations[lang];

  const brands = ['all', 'Jinko', 'Trina', 'LONGi', 'Growatt', 'Pylontech', 'JA Solar', 'SMA', 'BYD'];

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 mb-4 text-solar-blue text-xs font-black hover:opacity-80 transition"
      >
        <SlidersHorizontal size={14} />
        {t.advancedSearch}
      </button>
    );
  }

  return (
    <div className="bg-solar-card border border-solar-border rounded-3xl p-6 mb-6 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-solar-text flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-solar-blue" />
          {t.advancedSearch}
        </h3>
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="text-[10px] font-black text-solar-muted hover:text-solar-danger transition">{t.clearFilters}</button>
          <button onClick={() => setIsOpen(false)} className="text-solar-muted"><X size={20} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-solar-muted uppercase">{t.powerRange}</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              placeholder={t.min}
              value={filters.minPower}
              onChange={(e) => setFilters({ ...filters, minPower: e.target.value })}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-3 py-2 text-xs outline-none focus:border-solar-blue transition" 
            />
            <input 
              type="number" 
              placeholder={t.max}
              value={filters.maxPower}
              onChange={(e) => setFilters({ ...filters, maxPower: e.target.value })}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-3 py-2 text-xs outline-none focus:border-solar-blue transition" 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-solar-muted uppercase">{t.priceRange || 'Price Range'}</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              placeholder={t.min}
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-3 py-2 text-xs outline-none focus:border-solar-blue transition" 
            />
            <input 
              type="number" 
              placeholder={t.max}
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-3 py-2 text-xs outline-none focus:border-solar-blue transition" 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-solar-muted uppercase">{t.efficiencyMin}</label>
          <input 
            type="number" 
            placeholder="%"
            value={filters.minEfficiency}
            onChange={(e) => setFilters({ ...filters, minEfficiency: e.target.value })}
            className="w-full bg-solar-bg border border-solar-border rounded-xl px-3 py-2 text-xs outline-none focus:border-solar-blue transition" 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-solar-muted uppercase">{t.selectBrand}</label>
          <select 
            value={filters.brand}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
            className="w-full bg-solar-bg border border-solar-border rounded-xl px-3 py-2 text-xs outline-none focus:border-solar-blue transition font-bold"
          >
            {brands.map(b => (
              <option key={b} value={b}>{b === 'all' ? t.all : b}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
