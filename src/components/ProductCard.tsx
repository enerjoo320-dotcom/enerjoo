import React from 'react';
import { Power, Zap, Shield, ArrowLeftRight, ShieldCheck, Grid, MapPin, Edit, Heart } from 'lucide-react';
import { Product } from '../types';
import { translations } from '../translations';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface ProductCardProps {
  product: Product;
  lang: 'ar' | 'en';
  onClick: () => void;
  onCompare: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent, product: Product) => void;
  onWishlist?: (e: React.MouseEvent) => void;
  isCompared: boolean;
  isWishlisted?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  lang, 
  onClick, 
  onCompare, 
  onEdit, 
  onWishlist,
  isCompared,
  isWishlisted 
}) => {
  const { user } = useAuth();
  const t = translations[lang];
  const isAr = lang === 'ar';
  const isVerified = product.suppliers?.[0]?.verified;
  const isOwner = user?.uid === product.supplierId;

  const getDisplaySpecs = () => {
    const common = [
      { label: t.warranty, value: `${product.warranty} ${t.years}`, icon: <Shield size={14} /> }
    ];

    if (product.category === 'panels') {
      return [
        { label: t.power, value: `${product.power}W`, icon: <Power size={14} /> },
        { label: t.efficiency, value: `${product.efficiency}%`, icon: <Zap size={14} /> },
        ...common
      ];
    }
    
    if (product.category === 'inverters') {
      return [
        { label: t.powerKw, value: product.specs.powerKw || 'N/A', icon: <Power size={14} /> },
        { label: t.efficiency, value: `${product.efficiency}%`, icon: <Zap size={14} /> },
        ...common
      ];
    }

    if (product.category === 'batteries') {
       return [
        { label: t.capacity, value: product.specs.capacity || 'N/A', icon: <Zap size={14} /> },
        { label: t.voltage, value: product.specs.voltage || 'N/A', icon: <Zap size={14} /> },
        ...common
      ];
    }

    if (product.category === 'cables') {
      return [
        { label: t.crossSection, value: product.specs.crossSection || 'N/A', icon: <Grid size={14} /> },
        { label: t.length, value: product.specs.length || 'N/A', icon: <Grid size={14} /> },
        ...common
      ];
    }

    // Default for others
    return [
       { label: t.type, value: product.specs.type || 'N/A', icon: <Grid size={14} /> },
       { label: t.brand, value: product.brand, icon: <Zap size={14} /> },
       ...common
    ];
  };

  const specs = getDisplaySpecs();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="bg-solar-card rounded-3xl p-4 border border-solar-border shadow-sm hover:shadow-xl hover:shadow-solar-blue/5 transition-all group cursor-pointer"
    >
      <div className="relative aspect-video rounded-2xl overflow-hidden mb-4">
        <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={product.name} />
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1 items-start">
            {isOwner && onEdit && (
              <button 
                onClick={(e) => onEdit(e, product)}
                className="bg-solar-blue text-white p-1.5 rounded-lg pointer-events-auto shadow-lg hover:bg-solar-blue/90 transition active:scale-95 flex items-center gap-1 pr-2 mb-1"
              >
                <Edit size={12} />
                <span className="text-[9px] font-black uppercase">{isAr ? 'تعديل' : 'Edit'}</span>
              </button>
            )}
            <span className="bg-solar-blue/90 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg pointer-events-auto shadow-sm tracking-wide uppercase">
              {product.brand}
            </span>
            {isVerified && (
              <span className="bg-solar-success text-white text-[9px] font-black px-2 py-0.5 rounded-lg pointer-events-auto shadow-sm flex items-center gap-1">
                <ShieldCheck size={10} />
                {isAr ? 'معتمد' : 'Verified'}
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center pointer-events-auto">
            {onWishlist && (
              <button 
                onClick={onWishlist} 
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-lg ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white/90 backdrop-blur-md text-solar-muted hover:text-red-500'}`}
              >
                <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
            )}
            <button 
              onClick={onCompare} 
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-lg ${isCompared ? 'bg-solar-accent text-white' : 'bg-white/90 backdrop-blur-md text-solar-muted hover:text-solar-blue'}`}
            >
              <ArrowLeftRight size={18} />
            </button>
          </div>
        </div>
        {product.efficiency >= 22 && (
          <div className="absolute bottom-2 right-2 bg-solar-success/90 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">
            {t.bestEfficiencyTag}
          </div>
        )}
      </div>

      <h3 className="text-solar-text font-black text-base line-clamp-1 mb-1">{isAr ? product.nameAr : product.name}</h3>
      <div className="text-[10px] text-solar-muted mb-4 font-bold flex items-center gap-1.5 flex-wrap">
        <span className="bg-solar-light text-solar-blue px-2 py-0.5 rounded-full uppercase tracking-tighter">{product.category}</span>
        <span className="opacity-40">•</span>
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${product.status === 'out_of_stock' ? 'bg-red-500' : product.status === 'limited' ? 'bg-amber-500' : 'bg-solar-success'}`}></div>
          <span className={product.status === 'out_of_stock' ? 'text-red-600' : product.status === 'limited' ? 'text-amber-600' : ''}>
            {t[product.status] || t.available}
          </span>
        </div>
        <span className="opacity-40">•</span>
        <div className="flex items-center gap-1">
          <MapPin size={10} className="text-solar-blue" />
          <span>{product.suppliers?.[0]?.location || 'Egypt'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {specs.map((spec, i) => (
          <div key={i} className="bg-solar-bg p-2 rounded-xl flex flex-col items-center justify-center gap-1 border border-solar-border/50 group-hover:border-solar-blue/20 transition-colors">
            <div className="text-solar-blue opacity-70">{spec.icon}</div>
            <span className="text-[9px] text-solar-muted font-bold text-center leading-none">{spec.label}</span>
            <span className="text-[10px] text-solar-text font-black">{spec.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-solar-border pt-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-solar-muted font-bold leading-none mb-1">{t.from}</span>
          <span className="text-solar-blue font-black text-lg">{product.price.toLocaleString()} <span className="text-[10px]">{t.egp}</span></span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-solar-muted font-bold opacity-60">
          <Zap size={10} />
          {t.verified}
        </div>
      </div>
    </motion.div>
  );
};
