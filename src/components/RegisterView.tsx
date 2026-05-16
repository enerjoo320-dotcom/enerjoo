import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Briefcase, MapPin, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { translations } from '../translations';
import { ViewType } from '../types';
import { motion } from 'motion/react';

export const RegisterView: React.FC<{ 
  lang: 'ar' | 'en'; 
  setView: (view: ViewType) => void;
}> = ({ lang, setView }) => {
  const { register } = useAuth();
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [role, setRole] = useState<'customer' | 'supplier'>('customer');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    location: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setError(isAr ? 'يرجى ملء كافة الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      setError(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register(formData.email, formData.password, {
        name: formData.name,
        type: role,
        company: formData.company,
        location: formData.location,
        phone: formData.phone
      });
      setIsSuccess(true);
      
      setTimeout(() => {
        setView('home');
      }, 2000);
    } catch (err: any) {
      console.error("Registration Error:", err);
      let message = isAr ? 'فشل التسجيل' : 'Registration failed';
      
      const errorCode = err.code || (err.message && err.message.includes('auth/email-already-in-use') ? 'auth/email-already-in-use' : '');
      
      if (errorCode === 'auth/email-already-in-use' || err.message?.includes('auth/email-already-in-use')) {
        message = isAr ? 'هذا البريد الإلكتروني مستخدم بالفعل' : 'This email is already in use';
      } else if (err.code === 'auth/weak-password') {
        message = isAr ? 'كلمة المرور ضعيفة جداً' : 'The password is too weak';
      } else if (err.code === 'auth/invalid-email') {
        message = isAr ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
      } else if (err.code === 'auth/operation-not-allowed') {
        message = isAr ? 'هذه العملية غير مسموح بها حالياً' : 'This operation is not allowed right now';
      }
      
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-[550px] mx-auto py-20 text-center"
      >
        <div className="bg-solar-card rounded-[40px] p-12 border border-solar-border shadow-2xl shadow-solar-success/10">
          <div className="w-20 h-20 bg-solar-success text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-solar-success/30">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          </div>
          <h2 className="text-3xl font-black text-solar-text mb-4">
            {isAr ? 'تم التسجيل بنجاح!' : 'Successfully Registered!'}
          </h2>
          <p className="text-solar-muted font-bold leading-relaxed">
            {isAr 
              ? 'مرحباً بك في إنرجو (enerjoo). نأخذك الآن إلى لوحة التحكم الخاصة بك...' 
              : 'Welcome to enerjoo. Redirecting you to your dashboard...'}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[550px] mx-auto py-10"
    >
      <div className="text-center space-y-2 mb-8">
        <button 
          onClick={() => setView('login')}
          className="flex items-center gap-2 text-solar-muted hover:text-solar-blue transition text-sm font-bold mb-4 mx-auto"
        >
          <ArrowLeft size={16} className={isAr ? 'rotate-180' : ''} />
          {t.back}
        </button>
        <div className="w-16 h-16 bg-solar-blue text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-solar-blue/20">
          <UserIcon size={32} />
        </div>
        <h1 className="text-3xl font-black text-solar-text">{t.register}</h1>
        <p className="text-solar-muted text-sm leading-relaxed px-10">{t.joinLarge}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-solar-card rounded-[40px] p-8 md:p-10 border border-solar-border shadow-xl shadow-solar-blue/5 space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{isAr ? 'نوع الحساب' : 'Account Type'}</label>
          <div className="flex p-1.5 bg-solar-bg rounded-2xl border border-solar-border">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${role === 'customer' ? 'bg-white text-solar-blue shadow-sm ring-1 ring-solar-border' : 'text-solar-muted'}`}
            >
              {isAr ? 'مشتري / مستخدم' : 'Buyer / Customer'}
            </button>
            <button
              type="button"
              onClick={() => setRole('supplier')}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${role === 'supplier' ? 'bg-white text-solar-blue shadow-sm ring-1 ring-solar-border' : 'text-solar-muted'}`}
            >
              {isAr ? 'مورد / شركة' : 'Supplier / Company'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-solar-danger/10 text-solar-danger rounded-xl text-sm font-bold border border-solar-danger/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{t.fullName}</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition text-sm font-bold text-solar-text"
                placeholder={isAr ? "الاسم الكامل" : "John Doe"}
              />
            </div>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{t.email}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData(p => ({...p, email: e.target.value}))}
                className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition text-sm font-bold text-solar-text"
                placeholder="name@email.com"
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{t.password}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
              <input 
                type="password" 
                value={formData.password}
                onChange={e => setFormData(p => ({...p, password: e.target.value}))}
                className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition text-sm font-bold text-solar-text"
                placeholder="••••••••"
              />
            </div>
          </div>

          {role === 'supplier' && (
            <>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{isAr ? 'اسم الشركة' : 'Company Name'}</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
                  <input 
                    type="text" 
                    value={formData.company}
                    onChange={e => setFormData(p => ({...p, company: e.target.value}))}
                    className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition text-sm font-bold text-solar-text"
                    placeholder="SolarTech"
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{isAr ? 'رقم الهاتف (واتساب)' : 'Phone (WhatsApp)'}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted font-bold text-xs">+</span>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={e => setFormData(p => ({...p, phone: e.target.value}))}
                    className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-8 pr-4 outline-none focus:border-solar-blue transition text-sm font-bold text-solar-text"
                    placeholder="201234567890"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2 text-left">
                <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{isAr ? 'الموقع / المدينة' : 'Location / City'}</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
                  <input 
                    type="text" 
                    value={formData.location}
                    onChange={e => setFormData(p => ({...p, location: e.target.value}))}
                    className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition text-sm font-bold text-solar-text"
                    placeholder="Cairo, Egypt"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <button 
          type="submit"
          disabled={isLoading}
          className="w-full bg-solar-blue text-white py-4 rounded-2xl font-black hover:bg-opacity-90 shadow-xl shadow-solar-blue/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
        >
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t.register}
        </button>

        <div className="text-center pt-6 border-t border-solar-border">
          <p className="text-xs text-solar-muted font-bold">
            {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'} <button type="button" onClick={() => setView('login')} className="text-solar-blue font-black hover:underline">{t.login}</button>
          </p>
        </div>
      </form>
    </motion.div>
  );
};
