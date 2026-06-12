import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Power, Ruler, Zap, Shield, ArrowLeftRight, CheckCircle2, Download, MapPin, Grid, Edit, Heart, Star, MessageSquare } from 'lucide-react';
import { Product, ProductReview } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { ProductCard } from './ProductCard';
import { useAuth } from '../context/AuthContext';
import { subscribeToProductReviews, addProductReview, deleteProductReview } from '../services/firestoreService';
import { auth } from '../lib/firebase';

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
      initial={{ opacity: 0, x: isAr ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pb-20 md:pb-10"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-solar-muted hover:text-solar-blue transition font-bold">
            <ArrowRight size={18} className={isAr ? '' : 'rotate-180'} />
            {t.back}
          </button>
          {isOwner && onEdit && (
            <button 
              onClick={() => onEdit(product)}
              className="flex items-center gap-2 text-solar-blue hover:text-solar-blue/80 transition font-bold text-sm bg-solar-blue/10 px-3 py-1 rounded-full border border-solar-blue/20"
            >
              <Edit size={14} />
              {isAr ? 'تعديل المنتج' : 'Edit Product'}
            </button>
          )}
        </div>
        <span className="text-[10px] font-black text-solar-muted bg-solar-card px-3 py-1 rounded-full border border-solar-border shadow-sm tracking-widest uppercase">
          {product.brand}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 mb-16">
        <div className="space-y-6">
          <div className="relative group">
            <img src={product.image} className="w-full aspect-[4/3] object-cover rounded-[40px] shadow-2xl shadow-solar-blue/10 border-4 border-white" alt={product.name} />
            {user?.type !== 'admin' && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => onWishlist(product)} 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-xl active:scale-90 ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white text-solar-muted hover:text-red-500'}`}
                  title={isWishlisted ? t.removeFromWishlist : t.saveToWishlist}
                >
                  <Heart size={22} fill={isWishlisted ? 'currentColor' : 'none'} />
                </button>
                <button 
                  onClick={() => onCompare(product)} 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-xl active:scale-90 ${isCompared(product.id) ? 'bg-solar-accent text-white' : 'bg-white text-solar-muted hover:text-solar-blue'}`}
                >
                  <ArrowLeftRight size={22} />
                </button>
              </div>
            )}
          </div>
          
          <div className="bg-solar-card rounded-[32px] p-8 border border-solar-border shadow-sm">
            <h3 className="text-lg font-black text-solar-text mb-6 flex items-center gap-2">
              <Zap size={20} className="text-solar-blue" />
              {t.specs}
            </h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-10">
              {Object.entries(product.specs).map(([key, value]) => {
                if (key === 'description' || !value) return null;
                return (
                  <div key={key} className="flex flex-col border-b border-solar-border/30 pb-2">
                    <span className="text-[10px] font-black text-solar-muted uppercase tracking-wider mb-1">{getSpecLabel(key)}</span>
                    <span className="text-sm font-bold text-solar-text">{value as string}</span>
                  </div>
                );
              })}
            </div>
            {product.datasheetUrl && (
              <button 
                onClick={handleDownloadDatasheet}
                className="w-full mt-8 border-2 border-dashed border-solar-border text-solar-muted hover:text-solar-blue hover:border-solar-blue py-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2"
              >
                <Download size={16} />
                {t.downloadPDF}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-black text-solar-text leading-tight mb-4">{isAr ? product.nameAr : product.name}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="bg-solar-blue text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{product.brand}</span>
              {product.suppliers?.[0]?.verified && (
                <span className="bg-solar-success text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {isAr ? 'معتمد' : 'Verified'}
                </span>
              )}
              <span className="bg-solar-light text-solar-blue text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-solar-blue/10">{product.category}</span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-current transition-colors ${
                product.status === 'out_of_stock' ? 'bg-red-50 text-red-600 border-red-200' : 
                product.status === 'limited' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                'bg-solar-success/10 text-solar-success border-solar-success/10'
              }`}>
                {t[product.status] || t.available}
              </span>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 text-solar-muted text-xs font-bold leading-none">
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

          <div className="grid grid-cols-2 gap-4">
            {mainSpecs.map((spec, i) => (
              <div key={i} className="bg-solar-card border border-solar-border p-5 rounded-3xl shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-solar-bg flex items-center justify-center">
                    {spec.icon}
                  </div>
                  <span className="text-xs font-black text-solar-muted uppercase tracking-tighter">{spec.label}</span>
                </div>
                <div className="text-xl font-black text-solar-text">{spec.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white/50 backdrop-blur-sm rounded-[40px] p-8 border-2 border-white shadow-sm">
            <h4 className="text-sm font-black text-solar-muted uppercase tracking-widest mb-6">{t.supplier}</h4>
            <div className="space-y-4">
              {product.suppliers.map((s, i) => (
                <div 
                  key={i} 
                  onClick={() => onFilterSupplier(s.id)}
                  className="bg-white p-6 rounded-[32px] border border-solar-border hover:border-solar-blue transition-all cursor-pointer group shadow-sm hover:shadow-xl hover:shadow-solar-blue/10"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-solar-bg rounded-2xl flex items-center justify-center font-black text-solar-blue border border-solar-border">
                        {isAr ? s.nameAr?.[0] : s.name?.[0]}
                      </div>
                      <div>
                        <div className="font-black text-solar-text group-hover:text-solar-blue transition">{isAr ? s.nameAr : s.name}</div>
                        <div className="text-[10px] font-bold text-solar-muted flex items-center gap-1">
                          <MapPin size={10} />
                          {s.location}
                        </div>
                      </div>
                    </div>
                    {s.verified && (
                      <div className="flex items-center gap-1 text-solar-success bg-solar-success/10 px-2 py-1 rounded-lg text-[10px] font-black uppercase">
                        <CheckCircle2 size={12} />
                        {t.verified}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-solar-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-solar-muted uppercase tracking-widest leading-none mb-1">{t.price}</span>
                      <span className="text-2xl font-black text-solar-blue">{s.price.toLocaleString()} <span className="text-xs">{t.egp}</span></span>
                    </div>
                    <div className="text-[10px] font-bold text-solar-muted">
                      {t.lastUpdate}: {s.lastUpdate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => {
                  const firstSupplier = product.suppliers?.[0];
                  if (firstSupplier?.phone) {
                    const phone = firstSupplier.phone.replace(/\+/g, '').replace(/\s+/g, '');
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(isAr ? `مرحبا، أنا مهتم بمنتج ${product.nameAr}` : `Hi, I am interested in ${product.name}`)}`, '_blank');
                  }
                }}
                className="flex-[2] bg-solar-blue text-white py-5 rounded-[24px] font-black shadow-2xl shadow-solar-blue/30 transition hover:bg-opacity-90 active:scale-95 text-lg"
              >
                {t.contactSupplier}
              </button>
              <button 
                onClick={() => onCompare(product)}
                className={`flex-1 border font-black transition active:scale-95 flex items-center justify-center rounded-[24px] ${isCompared(product.id) ? 'bg-solar-accent border-solar-accent text-white' : 'bg-white border-solar-border text-solar-muted hover:text-solar-text'}`}
              >
                <ArrowLeftRight size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Reviews and Rating Section */}
      <div className="mt-16 bg-solar-card rounded-[40px] p-8 md:p-12 border border-solar-border shadow-sm">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Column 1: Rating Summary Stats */}
          <div className="lg:w-1/3 flex flex-col justify-center items-center lg:items-start text-center lg:text-left lg:border-r lg:border-solar-border/50 pb-8 lg:pb-0 lg:pe-8 dir-neutral">
            <h3 className="text-xl font-black text-solar-text mb-4 uppercase tracking-wider flex items-center gap-2 justify-center lg:justify-start">
              <Star className="text-amber-500 fill-amber-500" />
              {isAr ? 'التقييمات والآراء' : 'Reviews & Ratings'}
            </h3>
            
            <div className="flex items-baseline gap-2 mt-2 justify-center lg:justify-start">
              <span className="text-6xl font-black text-solar-text">{averageRating > 0 ? averageRating : '0.0'}</span>
              <span className="text-solar-muted font-bold">/ 5.0</span>
            </div>

            <div className="flex items-center text-amber-500 mt-3 mb-2 justify-center lg:justify-start gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={24}
                  className={(averageRating > 0 && i < Math.round(averageRating)) ? "fill-amber-500 text-amber-500" : "text-gray-200"}
                />
              ))}
            </div>

            <p className="text-xs font-bold text-solar-muted uppercase mt-2">
              {reviews.length} {isAr ? 'تقييمات موثقة من العملاء' : 'verified customer reviews'}
            </p>

            {/* Rating distribution breakdown */}
            <div className="w-full mt-6 space-y-2 max-w-xs">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviews.filter((r) => r.rating === stars).length;
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs font-bold text-solar-muted">
                    <span className="w-3 text-right">{stars}</span>
                    <Star size={12} className="fill-amber-500 text-amber-500 inline shrink-0" />
                    <div className="flex-1 h-2 bg-solar-bg rounded-full overflow-hidden border border-solar-border/30">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                    <span className="w-8 text-right font-black">{percentage.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Leaving feedback and reviews showcase */}
          <div className="flex-1 space-y-10">
            {/* Feedback Form: Only shown for authenticated users */}
            <div>
              {user ? (
                <form onSubmit={handleReviewSubmit} className="bg-solar-bg p-6 md:p-8 rounded-[32px] border border-solar-border/60">
                  <h4 className="text-md font-black text-solar-text mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-solar-blue" />
                    {isAr ? 'شاركنا بتجربتك ورأيك' : 'Share your feedback'}
                  </h4>

                  {/* Dynamic interactive star selector */}
                  <div className="flex items-center gap-2 mb-6 flex-wrap">
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
                          >
                            <Star
                              size={28}
                              className={isHighlighted ? "fill-amber-500 text-amber-500" : "text-gray-300"}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Text area inside a sleek layout */}
                  <div className="relative">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={isAr ? 'اكتب مراجعتك هنا بالتفصيل (كفاءة الأداء، عيوب المنتج، الضمان المالي...)' : 'Write your comprehensive feedback here (efficiency, material quality, delivery time...)'}
                      className="w-full h-32 px-5 py-4 rounded-2xl bg-white border border-solar-border focus:border-solar-blue focus:ring-1 focus:ring-solar-blue focus:outline-none text-sm transition-all shadow-inner placeholder-solar-muted/70"
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

                  <div className="flex justify-end mt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-solar-blue text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-solar-blue/20 transition active:scale-95 disabled:opacity-50 hover:bg-opacity-90 flex items-center gap-2 text-sm"
                    >
                      {isSubmitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال التقييم' : 'Submit Review')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-solar-bg p-6 md:p-8 rounded-[32px] border-2 border-dashed border-solar-border text-center">
                  <h4 className="text-sm font-black text-solar-muted uppercase tracking-widest mb-2">
                    {isAr ? 'هل قمت بشراء هذا المنتج أو تجربته؟' : 'Have you tried or purchased this product?'}
                  </h4>
                  <p className="text-xs font-bold text-solar-muted mb-4 max-w-sm mx-auto">
                    {isAr ? 'يرجى تسجيل الدخول أو إعداد حساب لتتمكن من إضافة تقييمك ومساعدة الآخرين.' : 'Please register or sign in to your account with Google or Email to leave feedback.'}
                  </p>
                  <div className="inline-block bg-solar-blue-light border border-solar-blue/20 text-solar-blue font-black px-6 py-2.5 rounded-xl text-xs uppercase cursor-default">
                    {isAr ? 'يرجى تسجيل الدخول من أعلى الصفحة لكتابة تقييم' : 'Please Sign In From Top Bar To Write Review'}
                  </div>
                </div>
              )}
            </div>

            {/* List of Reviews Panel */}
            <div className="space-y-6">
              <h4 className="text-sm font-black text-solar-muted uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={14} className="text-solar-blue" />
                {isAr ? 'آراء وتوصيات مجتمع الطاقة' : 'Community Feedbacks'} ({reviews.length})
              </h4>

              {reviews.length === 0 ? (
                <div className="text-center py-10 bg-solar-bg/50 rounded-3xl border border-solar-border/30">
                  <p className="text-xs font-bold text-solar-muted">
                    {isAr ? 'لا توجد تقييمات لهذا المنتج بعد. كن أول من يبدي رأيه!' : 'No reviews left for this product yet. Be the first to share your thoughts!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
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
                          className="bg-white p-6 rounded-[28px] border border-solar-border shadow-sm flex gap-4 hover:shadow-md transition"
                        >
                          <div className="w-10 h-10 rounded-full bg-solar-blue/10 text-solar-blue border border-solar-blue/25 flex items-center justify-center font-black shrink-0">
                            {initials}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <h5 className="font-black text-solar-text text-sm truncate">{r.userName}</h5>
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

                            <p className="text-xs font-bold text-solar-text leading-relaxed whitespace-pre-wrap">
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
        <div className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-solar-text flex items-center gap-3">
              <Grid className="text-solar-blue" />
              {t.moreFromSupplier}
            </h3>
            <button 
              onClick={() => onFilterSupplier(supplierId)}
              className="text-xs font-black text-solar-blue hover:underline uppercase tracking-widest"
            >
              {t.viewAll}
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
    </motion.div>
  );
};
