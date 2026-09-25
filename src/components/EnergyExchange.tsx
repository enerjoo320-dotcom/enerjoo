import React, { useState } from 'react';
import { TrendingUp, Edit2, Check, X, ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { SOLAR_PANEL_BRANDS, SolarPanelBrand, User } from '../types';
import { updateSolarPanelBrandPrice } from '../services/energyExchangeService';

interface EnergyExchangeProps {
  lang: 'ar' | 'en';
  user: User | null;
  prices: Record<string, number>;
  onNavigateToBrandProducts?: (brandName: string) => void;
}

export const EnergyExchange: React.FC<EnergyExchangeProps> = ({
  lang,
  user,
  prices,
  onNavigateToBrandProducts
}) => {
  const isAr = lang === 'ar';
  const isAdmin = user?.type === 'admin';

  const [editingBrand, setEditingBrand] = useState<SolarPanelBrand | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessBrand, setSaveSuccessBrand] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStartEdit = (brand: SolarPanelBrand) => {
    setEditingBrand(brand);
    setTempPrice(String(prices[brand] ?? 12.00));
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingBrand(null);
    setTempPrice('');
    setErrorMsg(null);
  };

  const handleSavePrice = async (brand: SolarPanelBrand) => {
    const parsed = parseFloat(tempPrice);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg(isAr ? 'يرجى إدخال سعر صحيح أكبر من الصفر' : 'Please enter a valid price greater than 0');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await updateSolarPanelBrandPrice(brand, parsed, user?.email);
      setEditingBrand(null);
      setSaveSuccessBrand(brand);
      setTimeout(() => setSaveSuccessBrand(null), 3000);
    } catch (err: any) {
      setErrorMsg(isAr ? 'فشل حفظ السعر، يرجى المحاولة مجدداً' : 'Failed to save price, please try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-solar-blue to-solar-dark text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-solar-gold mb-3">
              <TrendingUp size={14} className="text-solar-gold" />
              <span>{isAr ? 'بورصة الطاقة المركزية' : 'Central Energy Exchange'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mb-2">
              {isAr ? 'بورصة الألواح الشمسية (سعر الوات)' : 'Solar Panel Energy Exchange'}
            </h1>
            <p className="text-sm sm:text-base text-white/80 max-w-2xl">
              {isAr 
                ? 'المصدر المعتمد لتسعير الألواح الشمسية في السوق. يتم احتساب سعر اللوح الإجمالي تلقائياً: القدرة بالوات × سعر الوات للماركة.'
                : 'The official source for solar panel pricing. Panel price is calculated automatically: Power (W) × Brand Price Per Watt.'}
            </p>
          </div>

          {isAdmin ? (
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black self-start md:self-auto">
              <ShieldCheck size={18} className="text-emerald-400" />
              <span>{isAr ? 'لوحة تحكم المسؤول (تعديل مباشر)' : 'Admin Mode (Live Pricing)'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-xl text-xs text-white/80 self-start md:self-auto">
              <Zap size={15} className="text-solar-gold" />
              <span>{isAr ? 'تحديث لحظي مباشر' : 'Real-time Live Sync'}</span>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Brands Price Table / Grid */}
      <div className="bg-white rounded-2xl border border-solar-border shadow-sm overflow-hidden mb-8">
        <div className="p-4 sm:p-5 border-b border-solar-border bg-solar-light/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-black text-sm sm:text-base text-solar-dark">
              {isAr ? 'قائمة أسعار العلامات التجارية المعتمدة' : 'Official Brand Price Per Watt'}
            </h2>
          </div>
          <span className="text-xs text-solar-muted font-bold">
            {SOLAR_PANEL_BRANDS.length} {isAr ? 'علامات تجارية' : 'Brands'}
          </span>
        </div>

        <div className="divide-y divide-solar-border">
          {SOLAR_PANEL_BRANDS.map((brand, index) => {
            const currentPrice = prices[brand] ?? 12.00;
            const isEditing = editingBrand === brand;
            const isSuccess = saveSuccessBrand === brand;

            return (
              <div 
                key={brand}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  isSuccess ? 'bg-emerald-50/60' : 'hover:bg-solar-light/40'
                }`}
              >
                {/* Brand Name */}
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-solar-light text-solar-blue font-black flex items-center justify-center text-xs shrink-0 border border-solar-border/70">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-solar-dark notranslate">
                      {brand}
                    </h3>
                    <span className="text-[11px] font-bold text-solar-muted">
                      {isAr ? 'ألواح شمسية معتمدة' : 'Certified Solar Panels'}
                    </span>
                  </div>
                </div>

                {/* Price Display & Admin Editor */}
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  {isEditing ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.05"
                          min="1"
                          max="100"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          className="w-28 sm:w-32 px-3 py-1.5 text-base font-black text-solar-dark border-2 border-solar-blue rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-blue/20 bg-white"
                          autoFocus
                          disabled={isSaving}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePrice(brand);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] font-bold text-solar-muted pointer-events-none">
                          {isAr ? 'ج.م' : 'EGP'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSavePrice(brand)}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl transition flex items-center gap-1 font-bold text-xs disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
                        title={isAr ? 'حفظ السعر' : 'Save Price'}
                      >
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                        <span className="hidden sm:inline">{isAr ? 'حفظ' : 'Save'}</span>
                      </button>

                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-xl transition cursor-pointer active:scale-95"
                        title={isAr ? 'إلغاء' : 'Cancel'}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-right sm:text-left">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl sm:text-2xl font-black text-solar-blue">
                            {currentPrice.toFixed(2)}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-solar-dark">
                            {isAr ? 'ج.م/وات' : 'EGP/W'}
                          </span>
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleStartEdit(brand)}
                          className="flex items-center gap-1 text-xs font-black text-solar-blue hover:text-solar-dark bg-solar-blue/10 hover:bg-solar-blue/20 px-3 py-1.5 rounded-xl transition cursor-pointer active:scale-95 border border-solar-blue/20"
                          title={isAr ? 'تعديل سعر الوات' : 'Edit Price Per Watt'}
                        >
                          <Edit2 size={13} />
                          <span>{isAr ? 'تعديل' : 'Edit'}</span>
                        </button>
                      )}

                      {onNavigateToBrandProducts && (
                        <button
                          onClick={() => onNavigateToBrandProducts(brand)}
                          className="text-xs font-bold text-solar-muted hover:text-solar-blue transition underline cursor-pointer ml-1"
                        >
                          {isAr ? 'عرض الألواح' : 'View Panels'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pricing Formula Explanation Box */}
      <div className="bg-solar-light/60 border border-solar-border/80 rounded-2xl p-5 text-solar-dark text-xs sm:text-sm">
        <h4 className="font-black text-solar-dark text-sm mb-2 flex items-center gap-2">
          <Zap size={16} className="text-solar-blue" />
          <span>{isAr ? 'قاعدة تسعير الألواح الشمسية في المنصة' : 'Solar Panel Pricing Formula'}</span>
        </h4>
        <div className="p-3 bg-white rounded-xl border border-solar-border font-mono text-xs text-solar-blue font-bold mb-2">
          {isAr 
            ? 'سعر اللوح = قدرة اللوح (وات) × سعر الوات للماركة في البورصة'
            : 'Panel Price = Panel Power (W) × Brand Price Per Watt'}
        </div>
        <p className="text-solar-muted">
          {isAr 
            ? 'مثال توضيحي: لوح جينكو 725 وات مع سعر بورصة 12.00 ج.م/وات = 725 × 12 = 8,700 ج.م. عند تعديل السعر إلى 13.00 ج.م/وات يتم تحديث سعر اللوح فوراً إلى 9,425 ج.م في جميع بطاقات المنتجات والتفاصيل والبحث.'
            : 'Example: Jinko 725W at 12.00 EGP/W = 725 × 12 = 8,700 EGP. When price is adjusted to 13.00 EGP/W, all product cards and details automatically reflect 9,425 EGP.'}
        </p>
      </div>
    </div>
  );
};
