import React from 'react';
import { Heart, LogIn, LogOut, PlusCircle, Users, Globe, Package } from 'lucide-react';
import { translations } from '../translations';
import { User, ViewType } from '../types';

interface HeaderProps {
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
  user: User | null;
  onLogout: () => void;
  setView: (view: ViewType) => void;
}

export const Header: React.FC<HeaderProps> = ({ lang, setLang, user, onLogout, setView }) => {
  const t = translations[lang];
  const isAr = lang === 'ar';

  return (
    <header translate="no" className="sticky top-0 z-40 w-full glass border-b border-solar-border/70 pt-safe select-none notranslate">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Enerjoo Brand Logo */}
        <div 
          id="header-logo-container"
          className="h-10 sm:h-12 md:h-13 flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0" 
          onClick={() => setView('home')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setView('home');
            }
          }}
          title={isAr ? 'Enerjoo - عالم الطاقة بين يديك' : 'Enerjoo - Home'}
        >
          <img 
            id="header-enerjoo-logo"
            src="/enerjoo-logo-original-2026.jpeg" 
            alt="Enerjoo - عالم الطاقة بين يديك" 
            className="h-full w-auto max-h-11 sm:max-h-12 object-contain select-none block"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher */}
          <button 
            type="button"
            onClick={() => setLang(isAr ? 'en' : 'ar')}
            className="flex items-center gap-1.5 text-solar-muted hover:text-solar-blue transition font-black text-xs bg-solar-light hover:bg-solar-border/60 px-2.5 sm:px-3 py-1.5 rounded-full notranslate cursor-pointer active:scale-95"
            title={isAr ? 'التحويل إلى الإنجليزية' : 'Switch to Arabic'}
            translate="no"
          >
            <Globe size={14} className="text-solar-blue shrink-0" />
            <span translate="no" className="notranslate font-black text-[11px] sm:text-xs">{isAr ? 'English' : 'العربية'}</span>
          </button>

          {user?.type === 'supplier' ? (
            <button 
              onClick={() => setView('supplier-dashboard')}
              className="hidden md:flex items-center gap-2 text-solar-muted hover:text-solar-blue transition font-bold text-sm bg-solar-light px-3 py-1.5 rounded-full"
              title={t.myProducts || (isAr ? 'منتجاتي' : 'My Products')}
            >
              <Package size={18} className="text-solar-blue" />
              <span>{t.myProducts || (isAr ? 'منتجاتي' : 'My Products')}</span>
            </button>
          ) : user?.type !== 'admin' && (
            <button 
              onClick={() => setView('wishlist')}
              className="hidden md:flex items-center gap-2 text-solar-muted hover:text-red-500 transition font-bold text-sm bg-solar-light px-3 py-1.5 rounded-full"
              title={t.wishlist}
            >
              <Heart size={18} className="text-red-500" />
              <span>{t.wishlist}</span>
            </button>
          )}

          {user?.type === 'admin' && (
            <>
              <button 
                onClick={() => setView('admin-requests')}
                className="flex items-center gap-1 text-solar-blue hover:bg-solar-blue/10 transition font-black text-[11px] sm:text-xs bg-solar-blue/5 border border-solar-blue/20 px-2.5 sm:px-3 py-1.5 rounded-full"
              >
                <span>{isAr ? '⚡ الطلبات' : '⚡ Requests'}</span>
              </button>

              <button 
                onClick={() => setView('admin-suppliers')}
                className="hidden sm:flex items-center gap-2 text-solar-muted hover:text-solar-blue transition font-bold text-xs bg-solar-light px-3 py-1.5 rounded-full"
              >
                <Users size={16} />
                <span>{t.supplierList}</span>
              </button>
            </>
          )}

          {user?.type === 'supplier' && (
            <button 
              onClick={() => setView('add')}
              className="hidden md:flex items-center gap-2 text-solar-muted hover:text-solar-blue transition font-bold text-sm"
            >
              <PlusCircle size={18} />
              <span>{t.addProduct}</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div 
                className="flex items-center gap-2 bg-solar-light p-1 sm:px-3 sm:py-1.5 rounded-full cursor-pointer hover:bg-solar-border transition active:scale-95"
                onClick={() => setView('profile')}
                title={isAr ? 'الملف الشخصي' : 'Profile'}
              >
                {user.profileImage || user.avatar ? (
                  <img 
                    src={user.profileImage || user.avatar} 
                    className="w-7 h-7 sm:w-7 sm:h-7 rounded-full border border-solar-border object-cover" 
                    alt={user.name} 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-solar-blue/10 border border-solar-blue/20 flex items-center justify-center font-black text-xs text-solar-blue">
                    {(isAr ? user.nameAr || user.name : user.name)?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-xs font-bold text-solar-text hidden md:block">{isAr ? user.nameAr || user.name : user.name}</span>
              </div>
              <button 
                onClick={onLogout}
                className="p-1.5 sm:p-2 text-solar-muted hover:text-solar-danger transition rounded-lg"
                title={isAr ? 'تسجيل الخروج' : 'Log out'}
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView('login')}
              className="flex items-center gap-1.5 bg-solar-blue text-white px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md shadow-solar-blue/20 transition active:scale-95"
            >
              <LogIn size={16} />
              <span>{t.login}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
