import React, { useState } from 'react';
import { Shield, ShieldCheck, Phone, MapPin, Search, ArrowRight, Eye } from 'lucide-react';
import { Supplier } from '../types';
import { translations } from '../translations';
import { motion } from 'motion/react';

interface AdminSupplierManagementProps {
  lang: 'ar' | 'en';
  suppliers: Supplier[];
  onToggleVerification: (id: any) => void;
  onBack: () => void;
  initialSearch?: string;
  onViewSupplier: (id: any) => void;
}

export const AdminSupplierManagement: React.FC<AdminSupplierManagementProps> = ({ 
  lang, 
  suppliers, 
  onToggleVerification,
  onBack,
  initialSearch = '',
  onViewSupplier
}) => {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  const filteredSuppliers = suppliers.filter(s => {
    const name = isAr ? s.nameAr : s.name;
    return (name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
           (s.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (s.phone && s.phone.includes(searchTerm));
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-20 px-4 md:px-0"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            title={t.back}
            className="p-3 bg-solar-card rounded-2xl shadow-sm border border-solar-border hover:border-solar-blue transition-all"
          >
            <ArrowRight className={isAr ? "" : "rotate-180"} size={20} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-solar-text">{isAr ? 'إدارة الموردين' : 'Supplier Management'}</h1>
            <p className="text-solar-muted text-sm font-bold">{isAr ? `إجمالي الموردين: ${suppliers.length}` : `All Suppliers: ${suppliers.length}`}</p>
          </div>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className={`${isAr ? 'right-4' : 'left-4'} absolute top-1/2 -translate-y-1/2 text-solar-muted`} size={18} />
          <input 
            type="text"
            placeholder={isAr ? 'البحث باسم الشركة أو الموقع...' : 'Search by company or location...'}
            className={`w-full bg-solar-card border border-solar-border rounded-2xl py-4 ${isAr ? 'pr-12 pl-4' : 'pl-12 pr-4'} outline-none focus:border-solar-blue transition-all font-bold text-sm shadow-sm text-solar-text`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((supplier, idx) => (
          <motion.div 
            key={`${supplier.id || idx}-${idx}`}
            layout
            className="bg-solar-card rounded-3xl p-6 border border-solar-border shadow-sm relative overflow-hidden group hover:border-solar-blue/30 transition-all"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 ${supplier.verified ? 'bg-green-500' : 'bg-solar-muted'}`} />

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-solar-bg border border-solar-border rounded-2xl flex items-center justify-center font-black text-solar-blue text-xl shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                {(isAr ? supplier.nameAr : supplier.name)?.[0] || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-solar-text truncate text-lg">{isAr ? supplier.nameAr : supplier.name}</h3>
                  {supplier.verified && (
                    <div className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0" title={isAr ? 'معتمد' : 'Verified'}>
                      <ShieldCheck size={12} />
                      <span className="text-[8px] font-black uppercase tracking-tighter">{isAr ? 'معتمد' : 'VERIFIED'}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-solar-muted flex items-center gap-1 mt-0.5">
                  <MapPin size={12} />
                  {supplier.location}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm font-bold text-solar-muted bg-solar-bg/50 p-2.5 rounded-xl border border-solar-border/50">
                <Phone size={16} className="text-solar-blue" />
                <span className="truncate">{supplier.phone || '---'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-bold text-solar-muted bg-solar-bg/50 p-2.5 rounded-xl border border-solar-border/50">
                <Shield size={16} className="text-solar-blue" />
                <span className={supplier.verified ? 'text-green-500' : 'text-solar-muted'}>
                  {supplier.verified ? (isAr ? 'حساب معتمد وموثوق' : 'Verified & Trusted Account') : (isAr ? 'بانتظار التوثيق' : 'Pending Verification')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => onToggleVerification(supplier.id)}
                className={`flex-1 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                  supplier.verified 
                    ? 'bg-solar-bg border border-solar-border text-red-500 hover:bg-red-500 hover:text-white' 
                    : 'bg-green-500 text-white shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95'
                }`}
              >
                {supplier.verified ? (
                  <>
                    <Shield size={16} />
                    {isAr ? 'إلغاء الاعتماد' : 'Revoke'}
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    {isAr ? 'اعتماد كـ شريك معتمد' : 'Verify as Partner'}
                  </>
                )}
              </button>
              
              <button 
                onClick={() => onViewSupplier(supplier.id)}
                className="w-12 h-12 bg-solar-bg border border-solar-border text-solar-muted rounded-2xl hover:border-solar-blue hover:text-solar-blue transition-all flex items-center justify-center shadow-inner"
                title={t.viewProduct}
              >
                <Eye size={20} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="bg-solar-card border border-solar-border rounded-[32px] p-20 text-center shadow-sm">
          <div className="bg-solar-bg w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-solar-border shadow-inner">
            <Search className="text-solar-muted opacity-20" size={40} />
          </div>
          <h3 className="text-2xl font-black text-solar-text">{t.noData}</h3>
          <p className="text-solar-muted font-bold mt-2">{isAr ? 'لا يوجد موردين مسجلين بهذا الإسم حالياً' : 'No registered suppliers match your search criteria'}</p>
        </div>
      )}
    </motion.div>
  );
};
