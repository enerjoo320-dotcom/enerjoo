import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Power, Ruler, Zap, Shield, ArrowLeftRight, CheckCircle2, Download, MapPin, Grid, Edit, Heart, Star, MessageSquare } from 'lucide-react';
import { Product, ProductReview } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { ProductCard } from './ProductCard';
import { useAuth } from '../context/AuthContext';
import { subscribeToProductReviews, addProductReview, deleteProductReview } from '../services/firestoreService';
import { auth } from '../lib/firebase';
import { getSupplierWhatsAppUrl, SUPPLIER_CONTACT_PHONE_DISPLAY } from '../constants/contact';

interface ProductDetailProps {
  product: Product;
  allProducts: Product[];
  lang: 'ar' | 'en';
  onBack: () => void;
  onCompare: (product: Product) => void;
  onWishlist: (product: Product) => void;
  isCompared: (id: number | string) => boolean;
  isInWishlist: (id: number | string) => boolean;
  onProductClick: (product: Product) => void;
  onFilterSupplier: (id: string | number) => void;
  onEdit?: (product: Product) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ 
  product, 
  allProducts, 
  lang, 
  onBack, 
  onCompare, 
  onWishlist,
  isCompared,
  isInWishlist,
  onProductClick,
  onFilterSupplier,
  onEdit
}) => {
  const { user } = useAuth();
  const t = translations[lang];
  const isAr = lang === 'ar';
  const isWishlisted = isInWishlist(product.id);
  const isOwner = user?.uid === product.supplierId;

  const [selectedImage, setSelectedImage] = useState<string>(product.image);

  useEffect(() => {
    setSelectedImage(product.image);
  }, [product.image]);

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToProductReviews(product.id.toString(), setReviews);
    return () => unsub();
  }, [product.id]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setReviewError(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first');
      return;
    }

    if (!newComment.trim()) {
      setReviewError(isAr ? 'يرجى كتابة تعليق' : 'Please write a comment');
      return;
    }
    setIsSubmitting(true);
    setReviewError(null);
    try {
      await addProductReview(product.id.toString(), {
        userId: user.uid,
        userName: user.name || user.email || 'Anonymous User',
        rating: newRating,
        comment: newComment,
      });
      setNewComment('');
      setNewRating(5);
    } catch (err: any) {
      setReviewError(isAr ? 'فشل إضافة التقييم. حاول مرة أخرى.' : 'Failed to submit review. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewDelete = async (reviewId: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا التقييم؟' : 'Are you sure you want to delete this review?')) {
      return;
    }
    try {
      await deleteProductReview(product.id.toString(), reviewId);
    } catch (err) {
      console.error(err);
    }
  };

  const getMainSpecs = () => {
    const common = [
      { label: t.price, value: `${product.price.toLocaleString()} ${t.egp}`, icon: <CheckCircle2 className="text-solar-blue" /> },
      { label: t.warranty, value: `${product.warranty} ${t.years}`, icon: <Shield className="text-solar-success" /> },
    ];

    switch (product.category) {
      case 'panels':
        return [
          { label: t.power, value: `${product.power} ${t.watt}`, icon: <Power className="text-solar-blue" /> },
          { label: t.efficiency, value: `${product.efficiency}%`, icon: <Zap className="text-solar-warning" /> },
          { label: t.warranty, value: `${product.warranty} ${t.years}`, icon: <Shield className="text-solar-success" /> },
          { label: t.area, value: `${product.area} m²`, icon: <Ruler className="text-solar-accent" /> }
        ];
      case 'inverters':
        return [
          { label: t.powerKw, value: product.specs.powerKw || 'N/A', icon: <Power className="text-solar-blue" /> },
          { label: t.efficiency, value: `${product.efficiency}%`, icon: <Zap className="text-solar-warning" /> },
          { label: t.type, value: product.specs.type || 'N/A', icon: <Grid className="text-solar-accent" /> },
          { label: t.warranty, value: `${product.warranty} ${t.years}`, icon: <Shield className="text-solar-success" /> }
        ];
      case 'batteries':
        return [
          { label: t.capacity, value: product.specs.capacity || 'N/A', icon: <Zap className="text-solar-warning" /> },
          { label: t.voltage, value: product.specs.voltage || 'N/A', icon: <Zap className="text-solar-blue" /> },
          { label: t.type, value: product.specs.type || 'N/A', icon: <Grid className="text-solar-accent" /> },
          { label: t.warranty, value: `${product.warranty} ${t.years}`, icon: <Shield className="text-solar-success" /> }
        ];
      case 'cables':
        return [
          { label: t.crossSection, value: product.specs.crossSection || 'N/A', icon: <Ruler className="text-solar-accent" /> },
          { label: t.length, value: product.specs.length || 'N/A', icon: <Ruler className="text-solar-blue" /> },
          { label: t.voltage, value: product.specs.voltage || 'N/A', icon: <Zap className="text-solar-warning" /> },
          { label: t.material, value: product.specs.material || 'N/A', icon: <Grid className="text-solar-success" /> }
        ];
      default:
        return common;
    }
  };

  const mainSpecs = getMainSpecs();

  const getSpecLabel = (key: string) => {
    const labels: Record<string, string> = {
      type: t.type,
      voltage: t.voltage,
      current: t.current,
      weight: t.weight,
      capacity: t.capacity,
      powerKw: t.powerKw,
      crossSection: t.crossSection,
      length: t.length,
      material: t.material,
      maxWind: t.maxWind,
      ipRating: t.ipRating,
      poles: t.poles,
      quantity: t.quantityValue,
      color: t.color,
    };
    return labels[key] || key;
  };

  // Find other products from the same supplier
  const supplierId = product.supplierId;
  const otherProducts = allProducts.filter(p => 
    p.id !== product.id && 
    p.supplierId === supplierId
  ).slice(0, 4);

  const handleDownloadDatasheet = () => {
    if (!product.datasheetUrl) return;
    window.open(product.datasheetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-28 md:pb-10 max-w-7xl mx-auto px-0 w-full max-w-full box-border overflow-x-hidden"
    >
      <div className="flex items-center justify-between mb-4 sm:mb-6 w-full max-w-full box-border gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button 
            onClick={onBack} 
            className="flex items-center gap-1.5 text-solar-text hover:text-solar-blue transition font-black text-xs sm:text-sm bg-white border border-solar-border px-3 py-2 rounded-xl shadow-2xs active:scale-95 shrink-0"
          >
            <ArrowRight size={16} className={isAr ? '' : 'rotate-180'} />
            <span>{t.back}</span>
          </button>
          {isOwner && onEdit && (
            <button 
              onClick={() => onEdit(product)}
              className="flex items-center gap-1.5 text-solar-blue hover:text-solar-blue/80 transition font-black text-xs bg-solar-blue/10 px-3 py-2 rounded-xl border border-solar-blue/20 active:scale-95 shrink-0"
            >
              <Edit size={13} />
              <span>{isAr ? 'تعديل' : 'Edit'}</span>
            </button>
          )}
        </div>
        <span className="text-[10px] font-black text-solar-muted bg-solar-card px-3 py-1.5 rounded-xl border border-solar-border shadow-2xs tracking-wider uppercase truncate max-w-[140px] sm:max-w-none">
          {product.brand}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 mb-12 sm:mb-16 w-full max-w-full box-border min-w-0">
        <div className="space-y-4 sm:space-y-6 w-full max-w-full box-border min-w-0">
          <div className="relative group w-full max-w-full rounded-2xl sm:rounded-[40px] overflow-hidden box-border">
            <img 
              src={selectedImage || product.image} 
              referrerPolicy="no-referrer" 
              className="w-full max-w-full h-auto aspect-[4/3] object-cover rounded-2xl sm:rounded-[40px] shadow-2xl shadow-solar-blue/10 border-2 sm:border-4 border-white box-border" 
              alt={product.name} 
            />
            {user?.type !== 'admin' && (
              <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex gap-2">
                <button 
                  onClick={() => onWishlist(product)} 
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition shadow-xl active:scale-90 ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white text-solar-muted hover:text-red-500'}`}
                  title={isWishlisted ? t.removeFromWishlist : t.saveToWishlist}
                  aria-label={isWishlisted ? t.removeFromWishlist : t.saveToWishlist}
                >
                  <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
                </button>
                <button 
                  onClick={() => onCompare(product)} 
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition shadow-xl active:scale-90 ${isCompared(product.id) ? 'bg-solar-accent text-white' : 'bg-white text-solar-muted hover:text-solar-blue'}`}
                  aria-label={isAr ? 'مقارنة' : 'Compare'}
                >
                  <ArrowLeftRight size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Additional product images gallery thumbnails */}
          {product.additionalImages && product.additionalImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none w-full max-w-full box-border">
              {[product.image, ...product.additionalImages].map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImage(imgUrl)}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden border-2 shrink-0 transition ${
                    (selectedImage || product.image) === imgUrl 
                      ? 'border-solar-blue ring-2 ring-solar-blue/30 shadow-md scale-105' 
                      : 'border-solar-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          
          <div className="bg-solar-card rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 border border-solar-border shadow-sm w-full max-w-full box-border min-w-0">
            <h3 className="text-base sm:text-lg font-black text-solar-text mb-4 sm:mb-6 flex items-center gap-2">
              <Zap size={20} className="text-solar-blue shrink-0" />
              <span>{t.specs}</span>
            </h3>
            <div className="grid grid-cols-2 gap-y-4 sm:gap-y-6 gap-x-3 sm:gap-x-6 md:gap-x-10 w-full max-w-full box-border min-w-0">
              {Object.entries(product.specs).map(([key, value]) => {
                if (key === 'description' || !value) return null;
                return (
                  <div key={key} className="flex flex-col border-b border-solar-border/30 pb-2 min-w-0 w-full max-w-full box-border">
                    <span className="text-[10px] font-black text-solar-muted uppercase tracking-wider mb-1 truncate">{getSpecLabel(key)}</span>
                    <span className="text-xs sm:text-sm font-bold text-solar-text break-words [overflow-wrap:anywhere] [word-break:break-word]">{value as string}</span>
                  </div>
                );
              })}
            </div>
            {product.datasheetUrl && (
              <button 
                onClick={handleDownloadDatasheet}
                className="w-full max-w-full mt-6 sm:mt-8 border-2 border-dashed border-solar-border text-solar-muted hover:text-solar-blue hover:border-solar-blue py-3 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 box-border"
              >
                <Download size={16} />
                <span>{t.downloadPDF}</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6 sm:space-y-8 w-full max-w-full box-border min-w-0">
          <div className="w-full max-w-full box-border min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-solar-text leading-tight mb-3 sm:mb-4 break-words [overflow-wrap:anywhere] [word-break:break-word] w-full max-w-full">
              {isAr ? product.nameAr : product.name}
            </h1>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full max-w-full box-border">
              <span className="bg-solar-blue text-white text-[10px] font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-widest">{product.brand}</span>
              {product.suppliers?.[0]?.verified && (
                <span className="bg-solar-success text-white text-[10px] font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-widest shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {isAr ? 'معتمد' : 'Verified'}
                </span>
              )}
              <span className="bg-solar-light text-solar-blue text-[10px] font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-widest border border-solar-blue/10">{product.category}</span>
              <span className={`text-[10px] font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-widest border border-current transition-colors ${
                product.status === 'out_of_stock' ? 'bg-red-50 text-red-600 border-red-200' : 
                product.status === 'limited' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                'bg-solar-success/10 text-solar-success border-solar-success/10'
              }`}>
                {t[product.status] || t.available}
              </span>
            </div>
            {reviews.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3 text-solar-muted text-xs font-bold leading-none w-full max-w-full box-border">
                <div className="flex items-center text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < Math.round(averageRating) ? "fill-amber-500 text-amber-500" : "text-gray-300"}
                    />
                  ))}
                </div>
                <span className="text-solar-text font-black text-sm">{averageRating}</span>
                <span>•</span>
                <span>{reviews.length} {isAr ? 'تقييم' : 'reviews'}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full max-w-full box-border min-w-0">
            {mainSpecs.map((spec, i) => (
              <div key={i} className="bg-solar-card border border-solar-border p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition w-full max-w-full box-border min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-solar-bg flex items-center justify-center shrink-0">
                    {spec.icon}
                  </div>
                  <span className="text-[11px] sm:text-xs font-black text-solar-muted uppercase tracking-tighter truncate">{spec.label}</span>
                </div>
                <div className="text-base sm:text-xl font-black text-solar-text break-words [overflow-wrap:anywhere] [word-break:break-word] leading-snug">{spec.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white/50 backdrop-blur-sm rounded-2xl sm:rounded-[32px] md:rounded-[40px] p-4 sm:p-6 md:p-8 border-2 border-white shadow-sm w-full max-w-full box-border min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-solar-muted uppercase tracking-widest mb-4 sm:mb-6">{t.supplier}</h4>
            <div className="space-y-3 sm:space-y-4 w-full max-w-full box-border min-w-0">
              {product.suppliers.map((s, i) => (
                <div 
                  key={i} 
                  onClick={() => onFilterSupplier(s.id)}
                  className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border border-solar-border hover:border-solar-blue transition-all cursor-pointer group shadow-sm hover:shadow-xl hover:shadow-solar-blue/10 w-full max-w-full box-border min-w-0 overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-3 sm:mb-4 gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-solar-bg border border-solar-border flex items-center justify-center font-black text-solar-blue overflow-hidden shrink-0 shadow-sm">
                        {s.profileImage || s.avatar ? (
                          <img 
                            src={s.profileImage || s.avatar} 
                            alt={s.name} 
                            className="w-full h-full rounded-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xs sm:text-sm font-black text-solar-blue">
                            {(isAr ? s.nameAr || s.name : s.name)?.charAt(0)?.toUpperCase() || 'S'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-solar-text group-hover:text-solar-blue transition truncate text-sm sm:text-base">{isAr ? s.nameAr : s.name}</div>
                        <div className="text-[10px] font-bold text-solar-muted flex items-center gap-1 truncate">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate">{s.location}</span>
                        </div>
                      </div>
                    </div>
                    {s.verified && (
                      <div className="flex items-center gap-1 text-solar-success bg-solar-success/10 px-2 py-1 rounded-lg text-[10px] font-black uppercase shrink-0">
                        <CheckCircle2 size={12} />
                        <span>{t.verified}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-solar-border/50 gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-black text-solar-muted uppercase tracking-widest leading-none mb-1">{t.price}</span>
                      <span className="text-xl sm:text-2xl font-black text-solar-blue truncate">{s.price.toLocaleString()} <span className="text-xs">{t.egp}</span></span>
                    </div>
                    <div className="text-[10px] font-bold text-solar-muted text-right shrink-0">
                      {t.lastUpdate}: {s.lastUpdate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-10 w-full max-w-full box-border min-w-0">
              <button 
                onClick={() => {
                  const message = isAr 
                    ? `مرحباً، أنا مهتم بطلب / الاستفسار عن منتج: ${product.nameAr || product.name}` 
                    : `Hi, I am interested in ordering/inquiring about: ${product.name}`;
                  window.open(getSupplierWhatsAppUrl(message), '_blank');
                }}
                className="w-full sm:flex-[2] bg-solar-blue text-white py-4 sm:py-5 px-4 rounded-2xl sm:rounded-[24px] font-black shadow-2xl shadow-solar-blue/30 transition hover:bg-opacity-90 active:scale-95 text-sm sm:text-base md:text-lg flex items-center justify-center gap-2 box-border min-w-0"
              >
                <span className="truncate">{t.contactSupplier}</span>
                <span className="text-xs font-normal opacity-80 shrink-0" dir="ltr">({SUPPLIER_CONTACT_PHONE_DISPLAY})</span>
              </button>
              <button 
                onClick={() => onCompare(product)}
                className={`w-full sm:flex-1 py-3.5 sm:py-4 px-4 border font-black transition active:scale-95 flex items-center justify-center rounded-2xl sm:rounded-[24px] box-border min-w-0 ${isCompared(product.id) ? 'bg-solar-accent border-solar-accent text-white' : 'bg-white border-solar-border text-solar-muted hover:text-solar-text'}`}
                aria-label={isAr ? 'مقارنة' : 'Compare'}
              >
                <ArrowLeftRight size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Reviews and Rating Section */}
      <div className="mt-12 sm:mt-16 bg-solar-card rounded-2xl sm:rounded-[40px] p-4 sm:p-8 md:p-12 border border-solar-border shadow-sm w-full max-w-full box-border min-w-0">
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 w-full max-w-full box-border min-w-0">
          {/* Column 1: Rating Summary Stats */}
          <div className="w-full lg:w-1/3 flex flex-col justify-center items-center lg:items-start text-center lg:text-left lg:border-r lg:border-solar-border/50 pb-6 lg:pb-0 lg:pe-8 dir-neutral max-w-full box-border min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-solar-text mb-3 sm:mb-4 uppercase tracking-wider flex items-center gap-2 justify-center lg:justify-start">
              <Star className="text-amber-500 fill-amber-500 shrink-0" size={20} />
              <span>{isAr ? 'التقييمات والآراء' : 'Reviews & Ratings'}</span>
            </h3>
            
            <div className="flex items-baseline gap-2 mt-1 sm:mt-2 justify-center lg:justify-start">
              <span className="text-4xl sm:text-6xl font-black text-solar-text">{averageRating > 0 ? averageRating : '0.0'}</span>
              <span className="text-solar-muted font-bold">/ 5.0</span>
            </div>

            <div className="flex items-center text-amber-500 mt-3 mb-2 justify-center lg:justify-start gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={20}
                  className={(averageRating > 0 && i < Math.round(averageRating)) ? "fill-amber-500 text-amber-500" : "text-gray-200"}
                />
              ))}
            </div>

            <p className="text-xs font-bold text-solar-muted uppercase mt-2">
              {reviews.length} {isAr ? 'تقييمات موثقة من العملاء' : 'verified customer reviews'}
            </p>

            {/* Rating distribution breakdown */}
            <div className="w-full mt-4 sm:mt-6 space-y-2 max-w-full sm:max-w-xs box-border">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviews.filter((r) => r.rating === stars).length;
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 sm:gap-3 text-xs font-bold text-solar-muted w-full max-w-full box-border">
                    <span className="w-3 text-right">{stars}</span>
                    <Star size={12} className="fill-amber-500 text-amber-500 inline shrink-0" />
                    <div className="flex-1 h-2 bg-solar-bg rounded-full overflow-hidden border border-solar-border/30 min-w-0">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                    <span className="w-8 text-right font-black">{percentage.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Leaving feedback and reviews showcase */}
          <div className="flex-1 space-y-6 sm:space-y-10 w-full max-w-full box-border min-w-0">
            {/* Feedback Form: Only shown for authenticated users */}
            <div className="w-full max-w-full box-border min-w-0">
              {user ? (
                <form onSubmit={handleReviewSubmit} className="bg-solar-bg p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[32px] border border-solar-border/60 w-full max-w-full box-border min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-solar-text mb-3 sm:mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-solar-blue shrink-0" />
                    <span>{isAr ? 'شاركنا بتجربتك ورأيك' : 'Share your feedback'}</span>
                  </h4>

                  {/* Dynamic interactive star selector */}
                  <div className="flex items-center gap-2 mb-4 sm:mb-6 flex-wrap">
                    <span className="text-xs font-black text-solar-muted uppercase tracking-wider">
                      {isAr ? 'تقييمك للمنتج:' : 'Your Rating:'}
                    </span>
                    <div className="flex gap-1" dir="ltr">
                      {[1, 2, 3, 4, 5].map((starVal) => {
                        const isHighlighted = hoverRating !== null ? starVal <= hoverRating : starVal <= newRating;
                        return (
                          <button
                            type="button"
                            key={starVal}
                            onClick={() => setNewRating(starVal)}
                            onMouseEnter={() => setHoverRating(starVal)}
                            onMouseLeave={() => setHoverRating(null)}
                            className="text-amber-500 transition duration-150 transform hover:scale-125 focus:outline-none"
                            aria-label={`Rate ${starVal} stars`}
                          >
                            <Star
                              size={24}
                              className={isHighlighted ? "fill-amber-500 text-amber-500" : "text-gray-300"}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Text area inside a sleek layout */}
                  <div className="relative w-full max-w-full box-border">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={isAr ? 'اكتب مراجعتك هنا بالتفصيل (كفاءة الأداء، عيوب المنتج، الضمان المالي...)' : 'Write your comprehensive feedback here (efficiency, material quality, delivery time...)'}
                      className="w-full max-w-full h-28 sm:h-32 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-white border border-solar-border focus:border-solar-blue focus:ring-1 focus:ring-solar-blue focus:outline-none text-xs sm:text-sm transition-all shadow-inner placeholder-solar-muted/70 box-border"
                      maxLength={1000}
                    />
                    <div className="absolute bottom-3 right-4 text-[10px] font-mono text-solar-muted">
                      {newComment.length} / 1000
                    </div>
                  </div>

                  {reviewError && (
                    <p className="text-red-500 text-xs font-black mt-2 flex items-center gap-1">
                      ⚠️ {reviewError}
                    </p>
                  )}

                  <div className="flex justify-end mt-3 sm:mt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto bg-solar-blue text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black shadow-lg shadow-solar-blue/20 transition active:scale-95 disabled:opacity-50 hover:bg-opacity-90 flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      {isSubmitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال التقييم' : 'Submit Review')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-solar-bg p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[32px] border-2 border-dashed border-solar-border text-center w-full max-w-full box-border">
                  <h4 className="text-xs sm:text-sm font-black text-solar-muted uppercase tracking-widest mb-2">
                    {isAr ? 'هل قمت بشراء هذا المنتج أو تجربته؟' : 'Have you tried or purchased this product?'}
                  </h4>
                  <p className="text-xs font-bold text-solar-muted mb-4 max-w-sm mx-auto">
                    {isAr ? 'يرجى تسجيل الدخول أو إعداد حساب لتتمكن من إضافة تقييمك ومساعدة الآخرين.' : 'Please register or sign in to your account with Google or Email to leave feedback.'}
                  </p>
                  <div className="inline-block bg-solar-blue-light border border-solar-blue/20 text-solar-blue font-black px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs uppercase cursor-default max-w-full">
                    {isAr ? 'يرجى تسجيل الدخول من أعلى الصفحة لكتابة تقييم' : 'Please Sign In From Top Bar To Write Review'}
                  </div>
                </div>
              )}
            </div>

            {/* List of Reviews Panel */}
            <div className="space-y-4 sm:space-y-6 w-full max-w-full box-border min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-solar-muted uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={14} className="text-solar-blue shrink-0" />
                <span>{isAr ? 'آراء وتوصيات مجتمع الطاقة' : 'Community Feedbacks'} ({reviews.length})</span>
              </h4>

              {reviews.length === 0 ? (
                <div className="text-center py-8 sm:py-10 bg-solar-bg/50 rounded-2xl sm:rounded-3xl border border-solar-border/30 px-4">
                  <p className="text-xs font-bold text-solar-muted">
                    {isAr ? 'لا توجد تقييمات لهذا المنتج بعد. كن أول من يبدي رأيه!' : 'No reviews left for this product yet. Be the first to share your thoughts!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4 w-full max-w-full box-border min-w-0">
                  <AnimatePresence>
                    {reviews.map((r, index) => {
                      const isMyReview = user && user.uid === r.userId;
                      const initials = r.userName ? r.userName.charAt(0).toUpperCase() : '?';
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[28px] border border-solar-border shadow-sm flex gap-3 sm:gap-4 hover:shadow-md transition w-full max-w-full box-border min-w-0"
                        >
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-solar-blue/10 text-solar-blue border border-solar-blue/25 flex items-center justify-center font-black shrink-0 text-xs sm:text-sm">
                            {initials}
                          </div>
                          
                          <div className="flex-1 min-w-0 max-w-full">
                            <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                              <h5 className="font-black text-solar-text text-xs sm:text-sm truncate min-w-0">{r.userName}</h5>
                              <span className="text-[10px] font-bold text-solar-muted shrink-0">
                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                              </span>
                            </div>

                            <div className="flex items-center text-amber-500 mb-2 gap-0.5" dir="ltr">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  className={i < r.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"}
                                />
                              ))}
                            </div>

                            <p className="text-xs font-bold text-solar-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] w-full max-w-full">
                              {r.comment}
                            </p>

                            {isMyReview && (
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => handleReviewDelete(r.id)}
                                  className="text-[10px] font-black text-red-500 hover:underline hover:text-red-600 transition"
                                >
                                  {isAr ? 'حذف التقييم' : 'Delete Review'}
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {otherProducts.length > 0 && (
        <div className="mt-12 sm:mt-20 w-full max-w-full box-border min-w-0">
          <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
            <h3 className="text-lg sm:text-2xl font-black text-solar-text flex items-center gap-2 sm:gap-3 truncate">
              <Grid className="text-solar-blue shrink-0" size={22} />
              <span className="truncate">{t.moreFromSupplier}</span>
            </h3>
            <button 
              onClick={() => onFilterSupplier(supplierId)}
              className="text-xs font-black text-solar-blue hover:underline uppercase tracking-widest shrink-0"
            >
              {t.viewAll}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full box-border min-w-0">
            {otherProducts.map(p => (
              <ProductCard 
                key={p.id}
                product={p}
                lang={lang}
                onClick={() => onProductClick(p)}
                onCompare={(e) => {
                  e.stopPropagation();
                  onCompare(p);
                }}
                onWishlist={(e) => {
                  e.stopPropagation();
                  onWishlist(p);
                }}
                onEdit={(e, product) => {
                  e.stopPropagation();
                  if (onEdit) onEdit(product);
                }}
                isCompared={isCompared(p.id)}
                isWishlisted={isInWishlist(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mobile-First Sticky Action Bar */}
      <div 
        aria-label="Mobile Product Actions"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-solar-border/70 px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] flex items-center justify-between gap-2.5 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)] w-full max-w-full box-border overflow-hidden"
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-bold text-solar-muted leading-tight">{t.price}</span>
          <span className="text-base sm:text-lg font-black text-solar-blue truncate">
            {product.price.toLocaleString()} <span className="text-[11px] font-bold">{t.egp}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => onCompare(product)}
            className={`w-10 h-10 border font-black transition active:scale-95 flex items-center justify-center rounded-xl ${isCompared(product.id) ? 'bg-solar-accent border-solar-accent text-white' : 'bg-solar-light border-solar-border text-solar-muted'}`}
            title={isAr ? 'مقارنة' : 'Compare'}
            aria-label="Compare"
          >
            <ArrowLeftRight size={17} />
          </button>
          <button 
            onClick={() => {
              const message = isAr 
                ? `مرحباً، أنا مهتم بطلب / الاستفسار عن منتج: ${product.nameAr || product.name}` 
                : `Hi, I am interested in ordering/inquiring about: ${product.name}`;
              window.open(getSupplierWhatsAppUrl(message), '_blank');
            }}
            className="bg-solar-blue text-white px-3.5 sm:px-4 py-2.5 rounded-xl font-black shadow-md shadow-solar-blue/20 transition active:scale-95 text-xs flex items-center gap-1.5"
          >
            <span>{t.contactSupplier}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
