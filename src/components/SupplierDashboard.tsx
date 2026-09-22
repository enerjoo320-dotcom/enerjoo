import React, { useRef, useState } from 'react';
import { Package, Plus, Edit, Trash2, Search, Camera, Loader2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Supplier, ViewType } from '../types';
import { uploadSupplierProfileImage } from '../services/uploadService';
import { updateSupplierProfileImage } from '../services/firestoreService';

interface SupplierDashboardProps {
  lang: 'ar' | 'en';
  setView: (view: ViewType) => void;
  products: Product[];
  suppliers: Supplier[];
  onDelete: (id: string | number) => void | Promise<void>;
  onEdit: (product: Product) => void;
  adminSearch: string;
  setAdminSearch: (val: string) => void;
  adminFilterId: string | number | null;
  setAdminFilterId?: (val: string | number | null) => void;
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
  adminFilterId,
  setAdminFilterId
}) => {
  const { user, updateUserProfile } = useAuth();
  const t = translations[lang];
  const isAr = lang === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(productToDelete.id);
      setProductToDelete(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      if (file.size > 5 * 1024 * 1024) {
        setUploadStatus(isAr ? 'جاري تحسين وضغط الصورة قبل الرفع...' : 'Optimizing and compressing image before upload...');
      }
      const secureUrl = await uploadSupplierProfileImage(file, (status) => setUploadStatus(status), lang);
      await updateSupplierProfileImage(user.uid, secureUrl);
      await updateUserProfile({ profileImage: secureUrl, avatar: secureUrl });
    } catch (err) {
      console.error('Error updating supplier profile image in dashboard:', err);
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const myProducts = products.filter(p => {
    if (adminFilterId) {
      return (
        p.supplierId === adminFilterId || 
        p.supplierId?.toString() === adminFilterId.toString() ||
        p.suppliers?.some(s => s.id === adminFilterId || s.id?.toString() === adminFilterId.toString())
      );
    }
    
    if (user?.type === 'supplier') {
      return p.supplierId === user?.uid;
    }

    if (user?.type === 'admin') {
      if (!adminSearch.trim()) return true;
      
      const search = adminSearch.toLowerCase();
      const productName = (isAr ? p.nameAr || p.name : p.name).toLowerCase();
      const productBrand = (p.brand || '').toLowerCase();
      const matchesSupplier = p.suppliers?.some(s => 
        (s.name || '').toLowerCase().includes(search) || 
        (s.nameAr || '').toLowerCase().includes(search)
      );

      return productName.includes(search) || productBrand.includes(search) || !!matchesSupplier;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
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
            <h1 className="text-xl sm:text-3xl font-black text-solar-text">
              {user?.type === 'supplier' ? (t.myProducts || (isAr ? 'منتجاتي' : 'My Products')) : (isAr ? 'إدارة منتجات الموردين' : 'Supplier Products Management')}
            </h1>
            <div className="text-solar-muted text-xs sm:text-sm">
              {adminFilterId ? (
                <span className="flex items-center gap-2">
                  <span className="text-solar-blue font-black underline">
                    {isAr ? suppliers.find(s => s.id === adminFilterId)?.nameAr || suppliers.find(s => s.id === adminFilterId)?.name : suppliers.find(s => s.id === adminFilterId)?.name}
                  </span>
                  <span className="text-solar-muted">({t.products})</span>
                  {setAdminFilterId && (
                    <button 
                      onClick={() => setAdminFilterId(null)}
                      className="text-xs text-rose-600 hover:underline font-bold mr-1 cursor-pointer"
                    >
                      ({isAr ? 'إلغاء التصفية' : 'Clear filter'})
                    </button>
                  )}
                </span>
              ) : user?.type === 'admin' ? (
                <span className="text-solar-muted font-medium">
                  {isAr ? 'مراجعة وتعديل وحذف منتجات جميع الموردين المعتمدين' : 'Manage, edit and delete products of all verified suppliers'}
                </span>
              ) : (
                <>
                  {t.welcomeBack}, <span className="text-solar-blue font-black">{isAr ? user?.nameAr || user?.name : user?.name}</span>
                </>
              )}
            </div>
            {uploadStatus && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-solar-blue font-bold animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>{uploadStatus}</span>
              </div>
            )}
          </div>
        </div>

        {user?.type === 'admin' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {adminFilterId ? (
              <button 
                onClick={() => setAdminFilterId ? setAdminFilterId(null) : setView('supplier-dashboard')}
                className="bg-solar-light text-solar-text px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-solar-border transition text-center cursor-pointer"
              >
                {isAr ? 'عرض كافة منتجات الموردين' : 'View All Suppliers Products'}
              </button>
            ) : null}
            <button 
              onClick={() => setView('admin-suppliers')}
              className="bg-solar-light text-solar-blue px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-solar-blue/10 transition text-center cursor-pointer"
            >
              {isAr ? 'قائمة الموردين' : 'Suppliers List'}
            </button>
            <form onSubmit={handleAdminSearch} className="relative flex-1 max-w-md">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
              <input 
                type="text"
                placeholder={isAr ? 'ابحث عن منتج أو مورد...' : 'Search product or supplier...'}
                className="w-full bg-white border border-solar-border rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pr-12 pl-4 outline-none focus:border-solar-blue transition font-bold text-sm shadow-2xs text-solar-text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />
            </form>
          </div>
        )}

        {(user?.type === 'supplier' || user?.type === 'admin') && (
          <button 
            onClick={() => {
              if (user?.type === 'supplier' && !user?.verified) {
                alert(isAr ? 'عذراً، حسابك بانتظار توثيق وموافقة الإدارة قبل التمكن من إضافة منتجات.' : 'Your account is pending admin verification and approval before you can add products.');
                return;
              }
              setView('add');
            }}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-2xl font-black flex items-center justify-center gap-2 transition active:scale-95 text-sm ${
              user?.type === 'supplier' && !user?.verified 
                ? 'bg-solar-border text-solar-muted cursor-not-allowed opacity-70' 
                : 'bg-solar-blue text-white shadow-md shadow-solar-blue/20 hover:opacity-90 cursor-pointer'
            }`}
          >
            <Plus size={18} />
            {t.addNew}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {categoriesList.map(category => {
          const catProducts = groupedProducts[category.id] || [];
          if (catProducts.length === 0) return null;

          return (
            <div key={category.id} className="bg-solar-card rounded-2xl sm:rounded-[32px] p-4 sm:p-8 border border-solar-border shadow-2xs">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="font-black text-solar-text flex items-center gap-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-solar-blue/10 rounded-xl flex items-center justify-center text-solar-blue shrink-0">
                    <Package size={18} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-base sm:text-lg">{category.label}</span>
                    <span className="text-[10px] text-solar-muted uppercase tracking-wider">{catProducts.length} {t.products}</span>
                  </div>
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 sm:p-4 bg-solar-bg rounded-xl sm:rounded-2xl border border-solar-border/50 group hover:border-solar-blue/30 transition shadow-2xs gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl overflow-hidden border border-solar-border shrink-0 shadow-2xs">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-black text-solar-text text-xs sm:text-sm truncate">{isAr ? product.nameAr : product.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-solar-blue bg-solar-blue/5 px-2 py-0.5 rounded-full inline-block">{product.brand}</span>
                          {user?.type === 'admin' && (
                            (() => {
                              const s = suppliers.find(sup => sup.id === product.supplierId || sup.id?.toString() === product.supplierId?.toString()) || product.suppliers?.[0];
                              const sName = s ? (isAr ? s.nameAr || s.name : s.name) : null;
                              if (!sName) return null;
                              return (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full inline-block truncate max-w-[130px]">
                                  🏢 {sName}
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-solar-muted mt-0.5">{product.price.toLocaleString()} {t.egp}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => onEdit(product)}
                        className="w-10 h-10 flex items-center justify-center bg-white text-solar-muted hover:text-solar-blue hover:bg-solar-blue/5 rounded-xl border border-solar-border transition shadow-2xs active:scale-95"
                        title={isAr ? 'تعديل' : 'Edit'}
                        aria-label="Edit"
                      >
                        <Edit size={15} />
                      </button>
                      <button 
                        onClick={() => setProductToDelete(product)}
                        className="w-10 h-10 flex items-center justify-center bg-white text-solar-muted hover:text-solar-danger hover:bg-red-50 rounded-xl border border-solar-border transition shadow-2xs active:scale-95 cursor-pointer"
                        title={isAr ? 'حذف المنتج' : 'Delete Product'}
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
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
            {(user?.type === 'supplier' || user?.type === 'admin') && (
              <button 
                onClick={() => {
                  if (user?.type === 'supplier' && !user?.verified) {
                    alert(isAr ? 'عذراً، حسابك بانتظار توثيق وموافقة الإدارة قبل التمكن من إضافة منتجات.' : 'Your account is pending admin verification and approval before you can add products.');
                    return;
                  }
                  setView('add');
                }}
                className={`px-8 py-4 rounded-2xl font-black transition cursor-pointer ${
                  user?.type === 'supplier' && !user?.verified 
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-solar-card w-full max-w-md rounded-3xl p-6 sm:p-8 border border-solar-border shadow-2xl relative text-left"
            >
              <button 
                onClick={() => !isDeleting && setProductToDelete(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-solar-muted hover:text-solar-text hover:bg-solar-bg transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-5">
                <AlertTriangle size={28} />
              </div>

              <h3 className="text-xl font-black text-solar-text mb-2">
                {isAr ? 'تأكيد حذف المنتج' : 'Confirm Product Deletion'}
              </h3>
              
              <p className="text-solar-muted text-sm font-medium leading-relaxed mb-6">
                {isAr 
                  ? 'هل أنت متأكد من رغبتك في حذف هذا المنتج من متجرك نهائياً؟ لن يتمكن العملاء من رؤيته أو طلبه بعد الحذف.'
                  : 'Are you sure you want to permanently delete this product? Customers will no longer be able to view or request it.'}
              </p>

              {/* Product Info Preview */}
              <div className="flex items-center gap-3 p-3 bg-solar-bg rounded-2xl border border-solar-border mb-6">
                <div className="w-12 h-12 rounded-xl bg-white overflow-hidden border border-solar-border shrink-0">
                  <img src={productToDelete.image} alt={productToDelete.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-solar-text truncate">
                    {isAr ? productToDelete.nameAr : productToDelete.name}
                  </div>
                  <div className="text-[11px] text-solar-blue font-bold">
                    {productToDelete.brand}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-solar-border text-solar-text font-bold text-sm hover:bg-solar-bg transition active:scale-95 disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{isAr ? 'جاري الحذف...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>{isAr ? 'نعم، احذف المنتج' : 'Delete Product'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
