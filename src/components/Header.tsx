import React, { useEffect } from 'react';
import { Globe, Heart, LogIn, LogOut, PlusCircle, Users } from 'lucide-react';
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
    <header className="sticky top-0 z-40 w-full glass border-b border-solar-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setView('home')}
        >
          <div className="w-10 h-10 bg-solar-blue rounded-xl flex items-center justify-center shadow-lg shadow-solar-blue/20">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <span className="font-display font-black text-xl text-solar-text hidden sm:block">{t.appName}</span>
        </div>

        <div className="flex items-center gap-3">
          {user?.type !== 'admin' && (
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
            <button 
              onClick={() => setView('admin-suppliers')}
              className="flex items-center gap-2 text-solar-muted hover:text-solar-blue transition font-bold text-sm bg-solar-light px-3 py-1.5 rounded-full"
            >
              <Users size={18} />
              <span>{t.supplierList}</span>
            </button>
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

          <button 
            onClick={() => setLang(isAr ? 'en' : 'ar')}
            className="flex items-center gap-2 bg-solar-light hover:bg-solar-border border border-solar-border/40 px-3.5 py-1.5 rounded-full text-solar-text transition font-black text-xs cursor-pointer select-none"
            title={isAr ? "Switch to English" : "تغيير إلى العربية"}
          >
            <Globe size={15} className="text-solar-blue" />
            <span>{isAr ? "English" : "العربية"}</span>
          </button>

          {user ? (
            <div className="flex items-center gap-4">
              <div 
                className="flex items-center gap-2 bg-solar-light px-3 py-1.5 rounded-full cursor-pointer hover:bg-solar-border transition"
                onClick={() => setView('profile')}
              >
                <img src={user.avatar} className="w-7 h-7 rounded-full border border-solar-border" alt={user.name} />
                <span className="text-xs font-bold text-solar-text hidden md:block">{isAr ? user.nameAr : user.name}</span>
              </div>
              <button 
                onClick={onLogout}
                className="p-2 text-solar-muted hover:text-solar-danger transition"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView('login')}
              className="flex items-center gap-2 bg-solar-blue text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-solar-blue/20 transition active:scale-95"
            >
              <LogIn size={18} />
              <span>{t.login}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
