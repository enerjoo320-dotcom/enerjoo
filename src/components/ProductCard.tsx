import React, { useState } from 'react';
import { Power, Zap, Shield, ArrowLeftRight, ShieldCheck, Grid, MapPin, Edit, Heart, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { translations } from '../translations';
import { motion, useMotionValue, useTransform } from 'motion/react';
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

  // Swipe gesture state & motion values
  const x = useMotionValue(0);
  const [swipedAction, setSwipedAction] = useState<string | null>(null);

  // Background feedback transforms
  const backgroundOpacity = useTransform(x, [-120, -40, 0, 40, 120], [1, 0.7, 0, 0.7, 1]);
  const iconScale = useTransform(x, [-120, -50, 0, 50, 120], [1.3, 1, 0.5, 1, 1.3]);

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x;
    const swipeThreshold = 75;

    if (Math.abs(offset) > swipeThreshold) {
      if (onWishlist) {
        // Trigger synthetic event
        const dummyEvent = { stopPropagation: () => {} } as React.MouseEvent;
        onWishlist(dummyEvent);
        setSwipedAction(isWishlisted ? (isAr ? 'تمت الإزالة من المفضلة' : 'Removed from Wishlist') : (isAr ? 'تمت الإضافة للمفضلة ❤️' : 'Added to Wishlist ❤️'));
        setTimeout(() => setSwipedAction(null), 1800);
      }
    }
  };

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
    <div className="relative overflow-hidden rounded-3xl group touch-pan-y">
      {/* Background action reveal indicator when swiping */}
      <motion.div 
        style={{ opacity: backgroundOpacity }}
        className={`absolute inset-0 rounded-3xl flex items-center justify-between px-6 z-0 ${
          isWishlisted ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white' : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white'
        }`}
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 font-black text-xs">
          <Heart size={20} fill={isWishlisted ? 'none' : 'currentColor'} />
          <span>{isWishlisted ? (isAr ? 'حذف من المفضلة' : 'Remove') : (isAr ? 'إضافة للمفضلة' : 'Favorite')}</span>
        </motion.div>

        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 font-black text-xs">
          <span>{isWishlisted ? (isAr ? 'حذف من المفضلة' : 'Remove') : (isAr ? 'إضافة للمفضلة' : 'Favorite')}</span>
          <Heart size={20} fill={isWishlisted ? 'none' : 'currentColor'} />
        </motion.div>
      </motion.div>

      {/* Temporary Toast Badge after successful swipe */}
      {swipedAction && (
        <motion.div 
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-black px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 pointer-events-none"
        >
          <Sparkles size={12} className="text-amber-400" />
          <span>{swipedAction}</span>
        </motion.div>
      )}

      {/* Main draggable Card */}
      <motion.div 
        style={{ x }}
        drag={onWishlist ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        onClick={onClick}
        className="relative z-10 bg-solar-card rounded-[26px] sm:rounded-3xl p-3.5 sm:p-4 border border-solar-border shadow-xs hover:shadow-xl hover:shadow-solar-blue/5 transition-all cursor-pointer select-none"
      >
        <div className="relative aspect-[16/10] sm:aspect-video rounded-2xl overflow-hidden mb-3.5 bg-solar-bg">
          <img 
            src={product.image} 
            referrerPolicy="no-referrer" 
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none" 
            alt={isAr ? product.nameAr || product.name : product.name} 
          />
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
            <div className="flex flex-col gap-1 items-start">
              {isOwner && onEdit && (
                <button 
                  onClick={(e) => onEdit(e, product)}
                  className="bg-solar-blue text-white min-h-[32px] px-2.5 py-1 rounded-xl pointer-events-auto shadow-md hover:bg-solar-blue/90 transition active:scale-95 flex items-center gap-1.5 mb-1"
                >
                  <Edit size={13} />
                  <span className="text-[10px] font-black uppercase">{isAr ? 'تعديل' : 'Edit'}</span>
                </button>
              )}
              <span className="bg-solar-blue/90 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-lg pointer-events-auto shadow-xs tracking-wide uppercase">
                {product.brand}
              </span>
              {isVerified && (
                <span className="bg-solar-success text-white text-[9px] font-black px-2 py-0.5 rounded-lg pointer-events-auto shadow-xs flex items-center gap-1">
                  <ShieldCheck size={11} />
                  {isAr ? 'معتمد' : 'Verified'}
                </span>
              )}
            </div>
            {user?.type !== 'admin' && (
              <div className="flex gap-1.5 items-center pointer-events-auto">
                {onWishlist && (
                  <button 
                    onClick={onWishlist} 
                    className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white/95 backdrop-blur-md text-solar-muted hover:text-red-500'}`}
                    title={isWishlisted ? (isAr ? 'إزالة من المفضلة' : 'Remove from Wishlist') : (isAr ? 'إضافة للمفضلة' : 'Add to Wishlist')}
                    aria-label={isAr ? 'المفضلة' : 'Wishlist'}
                  >
                    <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button 
                  onClick={onCompare} 
                  className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md ${isCompared ? 'bg-solar-accent text-white' : 'bg-white/95 backdrop-blur-md text-solar-muted hover:text-solar-blue'}`}
                  title={isCompared ? (isAr ? 'تمت الإضافة للمقارنة' : 'Added to compare') : (isAr ? 'مقارنة' : 'Compare')}
                  aria-label={isAr ? 'مقارنة' : 'Compare'}
                >
                  <ArrowLeftRight size={18} />
                </button>
              </div>
            )}
          </div>
          {product.efficiency >= 22 && (
            <div className="absolute bottom-2 right-2 bg-solar-success/90 backdrop-blur-md text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xs">
              {t.bestEfficiencyTag}
            </div>
          )}
        </div>

        <h3 className="text-solar-text font-black text-base sm:text-lg line-clamp-1 mb-1.5">{isAr ? product.nameAr : product.name}</h3>
        <div className="text-[11px] text-solar-muted mb-3.5 font-bold flex items-center gap-1.5 flex-wrap">
          <span className="bg-solar-light text-solar-blue px-2 py-0.5 rounded-full uppercase tracking-tight text-[10px]">{product.category}</span>
          <span className="opacity-30">•</span>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${product.status === 'out_of_stock' ? 'bg-red-500' : product.status === 'limited' ? 'bg-amber-500' : 'bg-solar-success'}`}></div>
            <span className={product.status === 'out_of_stock' ? 'text-red-600 font-bold' : product.status === 'limited' ? 'text-amber-600 font-bold' : ''}>
              {t[product.status] || t.available}
            </span>
          </div>
          <span className="opacity-30">•</span>
          <div className="flex items-center gap-1">
            <MapPin size={11} className="text-solar-blue" />
            <span className="truncate max-w-[100px]">{product.suppliers?.[0]?.location || 'Egypt'}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3.5">
          {specs.map((spec, i) => (
            <div key={i} className="bg-solar-bg p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 border border-solar-border/50 group-hover:border-solar-blue/20 transition-colors min-h-[52px]">
              <div className="text-solar-blue opacity-70 mb-0.5">{spec.icon}</div>
              <span className="text-[9px] text-solar-muted font-bold text-center leading-none truncate w-full">{spec.label}</span>
              <span className="text-[10px] text-solar-text font-black truncate w-full text-center">{spec.value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-solar-border/60 pt-2.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-solar-muted font-bold leading-none mb-0.5">{t.from}</span>
            <span className="text-solar-blue font-black text-lg sm:text-xl leading-tight">
              {product.price.toLocaleString()} <span className="text-xs font-bold">{t.egp}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-solar-muted font-bold opacity-70">
            <Zap size={11} />
            {t.verified}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
