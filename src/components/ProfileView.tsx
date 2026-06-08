import React from 'react';
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
  Sparkles
} from 'lucide-react';
import { User as UserType, ViewType } from '../types';
import { translations } from '../translations';
import { motion } from 'motion/react';

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

  return (
    <div className="min-h-screen bg-slate-50/60 pb-32 pt-6 px-4 md:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* User Header Profile Card */}
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center border-4 border-white shadow-md relative overflow-hidden">
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                className="w-full h-full object-cover" 
                alt={user.name} 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center">
                <User size={36} strokeWidth={2} />
              </div>
            )}
            {user?.verified && (
              <div className="absolute bottom-1 right-1 bg-solar-success text-white p-1 rounded-full border-2 border-white shadow-sm">
                <ShieldCheck size={14} />
              </div>
            )}
          </div>
          
          <h2 className="text-xl font-black text-solar-text mt-4">
            {user ? (isAr ? user.nameAr || user.name : user.name) : (isAr ? 'مستخدم زائر' : 'Guest User')}
          </h2>
          <p className="text-xs text-solar-muted font-bold mt-1.5 leading-relaxed">
            {user ? user.email : (isAr ? 'قم بتسجيل الدخول للحصول على الميزات الكاملة' : 'Please log in to access full features')}
          </p>
        </div>

        {/* Section: Language switcher */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-solar-text px-2 text-right">
            {isAr ? 'اللغة' : 'Language'}
          </h3>
          <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded-[24px] border border-solar-border/50 shadow-sm">
            <button
              onClick={() => setLang('ar')}
              className={`py-3.5 px-4 rounded-[18px] font-black text-sm transition-all duration-300 cursor-pointer ${
                isAr 
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25' 
                  : 'bg-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              العربية
            </button>
            <button
              onClick={() => setLang('en')}
              className={`py-3.5 px-4 rounded-[18px] font-black text-sm transition-all duration-300 cursor-pointer ${
                !isAr 
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25' 
                  : 'bg-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              English
            </button>
          </div>
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

            {/* Row 3: Supplier Account */}
            <button 
              onClick={() => {
                if (user?.type === 'supplier') {
                  setView('supplier-dashboard');
                } else if (user?.type === 'admin') {
                  setView('admin-suppliers');
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
