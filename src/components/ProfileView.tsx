import React, { useState, useRef } from 'react';
import { 
  User, 
  LogIn, 
  Store, 
  Heart, 
  ArrowLeftRight, 
  Package, 
  Bell, 
  HelpCircle, 
  Info, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Sparkles,
  Camera,
  Loader2,
  Check
} from 'lucide-react';
import { User as UserType, ViewType } from '../types';
import { translations } from '../translations';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { uploadSupplierProfileImage } from '../services/uploadService';
import { updateSupplierProfileImage } from '../services/firestoreService';

interface ProfileViewProps {
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
  user: UserType | null;
  logout: () => void;
  setView: (view: ViewType) => void;
  wishlistCount: number;
  compareCount: number;
  productsCount: number;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  lang,
  setLang,
  user,
  logout,
  setView,
  wishlistCount,
  compareCount,
  productsCount
}) => {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateUserProfile } = useAuth();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Clear previous feedback
    setUploadError(null);
    setUploadSuccess(false);

    // Instant local preview
    const tempPreview = URL.createObjectURL(file);
    setPreviewImage(tempPreview);

    try {
      setIsUploading(true);
      const secureUrl = await uploadSupplierProfileImage(file);
      await updateSupplierProfileImage(user.uid, secureUrl);
      await updateUserProfile({ profileImage: secureUrl, avatar: secureUrl });
      
      setPreviewImage(secureUrl);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating supplier profile image:', err);
      setUploadError(err.message || (isAr ? 'فشل رفع وتحديث الصورة' : 'Failed to upload and update image'));
      setPreviewImage(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const currentImage = previewImage || user?.profileImage || user?.avatar;
  const userInitial = (isAr ? user?.nameAr || user?.name : user?.name)?.trim()?.charAt(0)?.toUpperCase() || 'S';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-32 pt-6 px-4 md:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* User Header Profile Card */}
        <div className="flex flex-col items-center text-center py-4">
          <div className="relative inline-block">
            {/* Small circular avatar: 48x48px visually */}
            <div 
              onClick={() => user && !isUploading && fileInputRef.current?.click()}
              className={`w-14 h-14 rounded-full bg-solar-bg border border-solar-border shadow-sm flex items-center justify-center overflow-hidden relative ${user ? 'cursor-pointer group hover:ring-2 hover:ring-solar-blue/40 transition-all' : ''}`}
              title={user ? (isAr ? 'اضغط لتغيير الصورة' : 'Click to change image') : undefined}
            >
              {currentImage ? (
                <img 
                  src={currentImage} 
                  className="w-full h-full rounded-full object-cover" 
                  alt={user?.name || 'User'} 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-solar-light flex items-center justify-center font-black text-solar-blue text-base">
                  {user ? userInitial : <User size={22} className="text-solar-muted" />}
                </div>
              )}

              {/* Upload spinner */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center z-10">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
              )}

              {/* Hover camera overlay */}
              {user && !isUploading && (
                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                  <Camera size={14} className="text-white" />
                </div>
              )}
            </div>

            {/* Profile Image Edit/Camera Button */}
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute -bottom-1 -right-1 bg-solar-blue text-white p-1.5 rounded-full border-2 border-white shadow-sm hover:bg-solar-blue/90 active:scale-95 transition cursor-pointer"
                  title={isAr ? 'تغيير صورة الحساب' : 'Change profile picture'}
                >
                  <Camera size={11} />
                </button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,image/jpg" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
              </>
            )}

            {/* Verified badge */}
            {user?.verified && (
              <div className="absolute -top-1 -right-1 bg-solar-success text-white p-0.5 rounded-full border border-white shadow-sm">
                <ShieldCheck size={11} />
              </div>
            )}
          </div>
          
          <h2 className="text-lg font-black text-solar-text mt-2.5">
            {user ? (isAr ? user.nameAr || user.name : user.name) : (isAr ? 'مستخدم زائر' : 'Guest User')}
          </h2>
          <p className="text-xs text-solar-muted font-bold mt-0.5 leading-relaxed">
            {user ? user.email : (isAr ? 'قم بتسجيل الدخول للحصول على الميزات الكاملة' : 'Please log in to access full features')}
          </p>

          {/* Upload notifications */}
          {uploadError && (
            <p className="text-[11px] text-solar-danger font-bold mt-2 bg-solar-danger/10 px-3 py-1 rounded-full">
              {uploadError}
            </p>
          )}
          {uploadSuccess && (
            <p className="text-[11px] text-solar-success font-bold mt-2 bg-solar-success/10 px-3 py-1 rounded-full flex items-center gap-1">
              <Check size={12} />
              <span>{isAr ? 'تم تحديث صورة المورد بنجاح' : 'Supplier image updated successfully'}</span>
            </p>
          )}
        </div>

        {/* Section: Account block */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-solar-text px-2 text-right">
            {isAr ? 'الحساب' : 'Account'}
          </h3>
          <div className="bg-white rounded-[28px] border border-solar-border/50 shadow-sm overflow-hidden divide-y divide-slate-100">
            {/* Row 1: My Account */}
            <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150">
              <div className="flex items-center gap-2.5 text-solar-muted font-black text-xs">
                {isAr ? 'مستخدم زائر' : 'Guest Account'}
                {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'حسابي' : 'My Account'}
                </span>
                <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                  <User size={18} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Row 2: Sign In / Register */}
            {!user ? (
              <button 
                onClick={() => setView('login')}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
              >
                <div>
                  {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-solar-text">
                    {isAr ? 'تسجيل الدخول / حساب جديد' : 'Login / Register'}
                  </span>
                  <div className="p-2.5 bg-yellow-50 text-yellow-500 rounded-xl">
                    <LogIn size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex items-center justify-between p-4 bg-white">
                <button
                  onClick={() => setView('home')}
                  className="text-xs bg-solar-blue/10 text-solar-blue font-black px-3 py-1.5 rounded-full cursor-pointer"
                >
                  {isAr ? 'تصفح كعضو' : 'Browse as Member'}
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-solar-text">
                    {isAr ? 'الحساب نشط' : 'Active Account'}
                  </span>
                  <div className="p-2.5 bg-green-50 text-green-500 rounded-xl">
                    <ShieldCheck size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            )}

            {/* Row 3: Supplier Account / Admin Requests */}
            {user?.type === 'admin' ? (
              <>
                <button 
                  onClick={() => setView('admin-requests')}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
                >
                  <div>
                    {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-solar-text">
                      {isAr ? 'إدارة طلبات وحسابات الطاقة الشمسية' : 'Solar Requests Management'}
                    </span>
                    <div className="p-2.5 bg-blue-50 text-solar-blue rounded-xl">
                      <Sparkles size={18} strokeWidth={2.5} />
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => setView('admin-suppliers')}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
                >
                  <div>
                    {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-solar-text">
                      {isAr ? 'إدارة وتوثيق الموردين' : 'Supplier Verification'}
                    </span>
                    <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                      <Store size={18} strokeWidth={2.5} />
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <button 
                onClick={() => {
                  if (user?.type === 'supplier') {
                    setView('supplier-dashboard');
                  } else {
                    setView('login');
                  }
                }}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
              >
                <div>
                  {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-solar-text">
                    {isAr ? 'حساب مورد' : 'Supplier Dashboard'}
                  </span>
                  <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                    <Store size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </button>
            )}

            {/* Row 4: My Solar System Requests for Customers */}
            {user && (
              <button 
                onClick={() => setView('customer-requests')}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
              >
                <div>
                  {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-solar-text">
                    {isAr ? 'طلباتي الشمسية وعروض الأسعار' : 'My Solar Requests & Quotes'}
                  </span>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Sparkles size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Section: Products block */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-solar-text px-2 text-right">
            {isAr ? 'المنتجات' : 'Products'}
          </h3>
          <div className="bg-white rounded-[28px] border border-solar-border/50 shadow-sm overflow-hidden divide-y divide-slate-100">
            {/* Row 1: Wishlist */}
            <button 
              onClick={() => setView('wishlist')}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
            >
              <div className="flex items-center gap-2 text-solar-muted font-black text-sm">
                <span>{wishlistCount}</span>
                {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'المفضلة' : 'Wishlist'}
                </span>
                <div className="p-2.5 bg-red-50 text-red-500 rounded-xl">
                  <Heart size={18} strokeWidth={2.5} />
                </div>
              </div>
            </button>

            {/* Row 2: Comparison */}
            <button 
              onClick={() => setView('compare')}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
            >
              <div className="flex items-center gap-2 text-solar-muted font-black text-sm">
                <span>{compareCount}</span>
                {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'مقارنة' : 'Compare'}
                </span>
                <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                  <ArrowLeftRight size={18} strokeWidth={2.5} />
                </div>
              </div>
            </button>

            {/* Row 3: My Products */}
            <button 
              onClick={() => {
                if (user) {
                  setView(user.type === 'customer' ? 'home' : 'supplier-dashboard');
                } else {
                  setView('login');
                }
              }}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
            >
              <div className="flex items-center gap-2 text-solar-muted font-black text-sm">
                <span>{productsCount}</span>
                {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'منتجاتي' : 'My Products'}
                </span>
                <div className="p-2.5 bg-yellow-50 text-yellow-500 rounded-xl">
                  <Package size={18} strokeWidth={2.5} />
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Section: Preferences block */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-solar-text px-2 text-right">
            {isAr ? 'التفضيلات' : 'Preferences'}
          </h3>
          <div className="bg-white rounded-[28px] border border-solar-border/50 shadow-sm overflow-hidden">
            {/* Row 1: Notifications */}
            <div className="flex items-center justify-between p-4 bg-white">
              <div>
                {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'الإشعارات' : 'Notifications'}
                </span>
                <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                  <Bell size={18} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Other block */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-solar-text px-2 text-right">
            {isAr ? 'أخرى' : 'Other'}
          </h3>
          <div className="bg-white rounded-[28px] border border-solar-border/50 shadow-sm overflow-hidden divide-y divide-slate-100">
            {/* Row 1: Help */}
            <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150">
              <div>
                {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'المساعدة والدعم' : 'Help & Support'}
                </span>
                <div className="p-2.5 bg-yellow-50 text-yellow-500 rounded-xl">
                  <HelpCircle size={18} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Row 2: About Application */}
            <div className="flex items-center justify-between p-4 bg-white">
              <div className="flex items-center gap-1.5 text-solar-muted font-black text-xs">
                v1.0.0
                {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-solar-text">
                  {isAr ? 'حول التطبيق' : 'About Application'}
                </span>
                <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                  <Info size={18} strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Row 3: Admin panel */}
            {user?.type === 'admin' && (
              <button 
                onClick={() => setView('admin-suppliers')}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition duration-150 text-right cursor-pointer"
              >
                <div>
                  {isAr ? <ChevronLeft size={16} className="text-solar-muted" /> : <ChevronRight size={16} className="text-solar-muted" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-solar-text">
                    {isAr ? 'لوحة التحكم' : 'Control Panel'}
                  </span>
                  <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                    <ShieldCheck size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Logout button */}
        {user && (
          <div className="pt-6 flex justify-center pb-12">
            <button 
              onClick={() => logout()}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 font-extrabold text-sm justify-center py-2 px-8 cursor-pointer active:scale-95 transition"
            >
              <LogOut size={18} className="translate-y-[1px]" />
              <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
