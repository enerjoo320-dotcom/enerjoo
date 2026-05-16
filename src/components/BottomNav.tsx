import React from 'react';
import { Home, PlusCircle, ArrowLeftRight, User, LogIn, LayoutDashboard, Heart } from 'lucide-react';
import { translations } from '../translations';
import { User as UserType, ViewType } from '../types';
import { motion } from 'motion/react';

interface BottomNavProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  lang: 'ar' | 'en';
  user: UserType | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView, lang, user }) => {
  const t = translations[lang];
  
  const navItems: { id: ViewType; icon: React.ReactNode; label: string; show: boolean }[] = [
    { id: 'home', icon: <Home size={20} strokeWidth={2.5} />, label: t.home, show: true },
    { id: 'compare', icon: <ArrowLeftRight size={20} strokeWidth={2.5} />, label: t.compare, show: true },
    { id: 'wishlist', icon: <Heart size={20} strokeWidth={2.5} />, label: t.wishlist, show: true },
    { 
      id: user?.type === 'admin' ? 'admin-suppliers' : 'add', 
      icon: <PlusCircle size={20} strokeWidth={2.5} />, 
      label: user?.type === 'admin' ? t.manageSuppliers : t.addProduct, 
      show: user !== null && user.type !== 'customer'
    },
    { 
      id: user ? (user.type === 'supplier' ? 'supplier-dashboard' : (user.type === 'admin' ? 'admin-suppliers' : 'profile')) : 'login', 
      icon: user ? <User size={20} strokeWidth={2.5} /> : <LogIn size={20} strokeWidth={2.5} />, 
      label: user ? (user.type === 'customer' ? t.profile || 'Profile' : t.dashboard) : t.login, 
      show: true 
    }
  ];

  return (
    <nav className="fixed bottom-5 left-6 right-6 bg-white/95 backdrop-blur-3xl border border-solar-border/30 z-[100] md:hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden">
      <div className="flex justify-around items-center h-18 px-4">
        {navItems.filter(item => item.show).map(item => {
          const isActive = currentView === item.id;
          return (
            <button 
              key={item.id} 
              onClick={() => setView(item.id)} 
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300 relative ${isActive ? 'text-solar-blue' : 'text-solar-muted hover:text-solar-blue/70'}`}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute -top-[1px] w-10 h-1 bg-solar-blue rounded-b-full shadow-[0_5px_15px_rgba(0,102,255,0.4)]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <div className={`p-2 rounded-2xl transition-all duration-500 ${isActive ? 'bg-solar-blue/10 scale-110' : 'scale-100 opacity-60'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-black tracking-tight uppercase ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
