import React, { useRef, useState } from 'react';
import { Package, Plus, Edit, Trash2, Search, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { translations } from '../translations';
import { motion } from 'motion/react';
import { Product, Supplier, ViewType } from '../types';
import { uploadSupplierProfileImage } from '../services/uploadService';
import { updateSupplierProfileImage } from '../services/firestoreService';

interface SupplierDashboardProps {
  lang: 'ar' | 'en';
  setView: (view: ViewType) => void;
  products: Product[];
  suppliers: Supplier[];
  onDelete: (id: string | number) => void;
  onEdit: (product: Product) => void;
  adminSearch: string;
  setAdminSearch: (val: string) => void;
  adminFilterId: string | number | null;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ 
  lang, 
  setView, 
  products, 
  suppliers,
  onDelete, 
  onEdit,
  adminSearch,
  setAdminSearch,
  adminFilterId
}) => {
  const { user, updateUserProfile } = useAuth();
  const t = translations[lang];
  const isAr = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      const secureUrl = await uploadSupplierProfileImage(file);
      await updateSupplierProfileImage(user.uid, secureUrl);
      await updateUserProfile({ profileImage: secureUrl, avatar: secureUrl });
    } catch (err) {
      console.error('Error updating supplier profile image in dashboard:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const myProducts = products.filter(p => {
    if (adminFilterId) {
      return p.supplierId === adminFilterId || p.supplierId.toString() === adminFilterId.toString();
    }
    
    if (user?.type === 'supplier') {
      return p.supplierId === user?.uid;
    }

    if (user?.type === 'admin') {
      if (!adminSearch.trim()) return true;
      
      const search = adminSearch.toLowerCase();
      const productName = (isAr ? p.nameAr : p.name).toLowerCase();
      const productBrand = p.brand.toLowerCase();
      const matchesSupplier = p.suppliers.some(s => 
        (s.name || '').toLowerCase().includes(search) || 
        (s.nameAr || '').toLowerCase().includes(search)
      );

      return productName.includes(search) || productBrand.includes(search) || matchesSupplier;
    }

    return false;
  });

  const handleAdminSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminSearch.trim()) {
      setView('admin-suppliers');
    }
  };

  const categoriesList = [
    { id: 'panels', label: t.panels },
    { id: 'inverters', label: t.inverters },
    { id: 'batteries', label: t.batteries },
    { id: 'mounting', label: t.mounting },
    { id: 'protection', label: t.protection },
    { id: 'combiner', label: t.combiner },
    { id: 'cables', label: t.cables },
    { id: 'mc4', label: t.mc4 },
    { id: 'sealings', label: t.sealings },
    { id: 'clamps', label: t.clamps },
  ];

  const groupedProducts = React.useMemo(() => {
    const groups: Record<string, Product[]> = {};
    myProducts.forEach(p => {
      const cat = p.category.toLowerCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [myProducts]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          {adminFilterId ? (
            (() => {
              const currentSup = suppliers.find(s => s.id === adminFilterId || s.id?.toString() === adminFilterId?.toString());
              const supImg = currentSup?.profileImage || currentSup?.avatar;
              const supInit = (isAr ? currentSup?.nameAr || currentSup?.name : currentSup?.name)?.charAt(0)?.toUpperCase() || 'S';
              return (
                <div className="w-10 h-10 rounded-full bg-solar-bg border border-solar-border flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {supImg ? (
                    <img src={supImg} alt={currentSup?.name || 'Supplier'} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="font-black text-sm text-solar-blue">{supInit}</span>
                  )}
                </div>
              );
            })()
          ) : user ? (
            <div className="relative group">
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="w-10 h-10 rounded-full bg-solar-bg border border-solar-border flex items-center justify-center overflow-hidden shrink-0 shadow-sm cursor-pointer hover:ring-2 hover:ring-solar-blue/40 transition relative"
                title={isAr ? 'تغيير صورة المورد' : 'Change profile picture'}
              >
                {user.profileImage || user.avatar ? (
                  <img src={user.profileImage || user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="font-black text-sm text-solar-blue">
                    {(isAr ? user.nameAr || user.name : user.name)?.charAt(0)?.toUpperCase() || 'S'}
                  </span>
                )}

                {isUploading ? (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={14} className="text-white animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera size={13} className="text-white" />
                  </div>
                )}
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/jpeg,image/png,image/webp,image/jpg" 
                className="hidden" 
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
            </div>
          ) : null}

          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-black text-solar-text">{t.dashboard}</h1>
            <div className="text-solar-muted text-xs sm:text-sm">
              {adminFilterId ? (
                <span className="flex items-center gap-2">
                  <span className="text-solar-blue font-black underline">
                    {isAr ? suppliers.find(s => s.id === adminFilterId)?.nameAr || suppliers.find(s => s.id === adminFilterId)?.name : suppliers.find(s => s.id === adminFilterId)?.name}
                  </span>
                  <span className="text-solar-muted">({t.products})</span>
                </span>
              ) : (
                <>
                  {t.welcomeBack}, <span className="text-solar-blue font-black">{isAr ? user?.nameAr || user?.name : user?.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {user?.type === 'admin' && (
          <div className="flex items-center gap-3">
            {adminFilterId && (
              <button 
                onClick={() => setView('admin-suppliers')}
                className="bg-solar-light text-solar-text px-4 py-2 rounded-xl font-bold text-xs hover:bg-solar-border transition"
              >
                {isAr ? 'العودة لجميع الموردين' : 'Back to All Suppliers'}
              </button>
            )}
            <form onSubmit={handleAdminSearch} className="relative flex-1 max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
            <input 
              type="text"
              placeholder={isAr ? 'ابحث عن مورد للمصادقة...' : 'Search supplier to verify...'}
              className="w-full bg-white border border-solar-border rounded-2xl py-3 pr-12 pl-4 outline-none focus:border-solar-blue transition font-bold text-sm shadow-sm text-solar-text"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
            />
          </form>
          </div>
        )}

        {user?.type === 'supplier' && (
          <button 
            onClick={() => {
              if (!user?.verified) {
                alert(isAr ? 'عذراً، حسابك بانتظار توثيق وموافقة الإدارة قبل التمكن من إضافة منتجات.' : 'Your account is pending admin verification and approval before you can add products.');
                return;
              }
              setView('add');
            }}
            className={`px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition active:scale-95 ${
              !user?.verified 
                ? 'bg-solar-border text-solar-muted cursor-not-allowed opacity-70' 
                : 'bg-solar-blue text-white shadow-xl shadow-solar-blue/20 hover:opacity-90'
            }`}
          >
            <Plus size={20} />
            {t.addNew}
          </button>
        )}
      </div>

      <div className="space-y-8">
        {categoriesList.map(category => {
          const catProducts = groupedProducts[category.id] || [];
          if (catProducts.length === 0) return null;

          return (
            <div key={category.id} className="bg-solar-card rounded-[32px] p-8 border border-solar-border shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-solar-text flex items-center gap-3">
                  <div className="w-10 h-10 bg-solar-blue/10 rounded-xl flex items-center justify-center text-solar-blue">
                    <Package size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg">{category.label}</span>
                    <span className="text-[10px] text-solar-muted uppercase tracking-widest">{catProducts.length} {t.products}</span>
                  </div>
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-solar-bg rounded-2xl border border-solar-border/50 group hover:border-solar-blue/30 transition shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white rounded-xl overflow-hidden border border-solar-border shrink-0 shadow-sm">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <div className="font-black text-solar-text text-sm line-clamp-1">{isAr ? product.nameAr : product.name}</div>
                        <div className="text-[10px] font-bold text-solar-blue bg-solar-blue/5 px-2 py-0.5 rounded-full inline-block mt-1">{product.brand}</div>
                        <div className="text-[10px] font-bold text-solar-muted mt-1">{product.price.toLocaleString()} {t.egp}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => onEdit(product)}
                        className="p-2.5 bg-white text-solar-muted hover:text-solar-blue hover:bg-solar-blue/5 rounded-xl border border-solar-border transition shadow-sm"
                        title={isAr ? 'تعديل' : 'Edit'}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(product.id)}
                        className="p-2.5 bg-white text-solar-muted hover:text-solar-danger hover:bg-red-50 rounded-xl border border-solar-border transition shadow-sm"
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {myProducts.length === 0 && (
          <div className="bg-solar-card rounded-[32px] p-20 border border-solar-border shadow-sm text-center">
            <div className="w-20 h-20 bg-solar-light rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={40} className="text-solar-blue opacity-50" />
            </div>
            <h3 className="text-xl font-black text-solar-text mb-2">{isAr ? 'لا يوجد منتجات بعد' : 'No products yet'}</h3>
            <p className="text-solar-muted font-bold mb-8">{isAr ? 'ابدأ بإضافة منتجاتك لتظهر لعملائك' : 'Start adding your products to show them to your customers'}</p>
            {user?.type === 'supplier' && (
              <button 
                onClick={() => {
                  if (!user?.verified) {
                    alert(isAr ? 'عذراً، حسابك بانتظار توثيق وموافقة الإدارة قبل التمكن من إضافة منتجات.' : 'Your account is pending admin verification and approval before you can add products.');
                    return;
                  }
                  setView('add');
                }}
                className={`px-8 py-4 rounded-2xl font-black transition ${
                  !user?.verified 
                    ? 'bg-solar-border text-solar-muted cursor-not-allowed opacity-70' 
                    : 'bg-solar-blue text-white shadow-xl shadow-solar-blue/20 hover:scale-105 active:scale-95'
                }`}
              >
                {t.addNew}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
