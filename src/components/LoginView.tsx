import React, { useState } from 'react';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { translations } from '../translations';
import { ViewType } from '../types';
import { motion } from 'motion/react';
import { SecurityCaptcha } from './SecurityCaptcha';

interface LoginViewProps {
  lang: 'ar' | 'en';
  setView: (view: ViewType) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ lang, setView }) => {
  const { login, signInWithGoogle } = useAuth();
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaVerified) {
      setError(isAr ? 'يرجى إكمال التحقق الأمني أولاً (أنا لست برنامج روبوت)' : "Please complete the security verification first (I'm not a robot)");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      setView('home');
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = isAr ? 'خطأ في البريد الإلكتروني أو كلمة المرور' : 'Invalid email or password';
      if (error.code === 'auth/user-not-found') message = isAr ? 'المستخدم غير موجود' : 'User not found';
      if (error.code === 'auth/wrong-password') message = isAr ? 'كلمة مرور خاطئة' : 'Wrong password';
      if (error.code === 'auth/invalid-credential') message = isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password credentials.';
      if (error.code === 'auth/network-request-failed') message = isAr ? 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت' : 'Network error. Please check your internet connection or browser settings.';
      if (error.code === 'auth/operation-not-allowed') message = isAr ? 'تسجيل الدخول بالبريد غير مفعّل في لوحة Firebase الخاصة بك حالياً' : 'Email authentication is not enabled in your Firebase console';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle('customer');
      setView('home');
    } catch (err: any) {
      console.error("Google Sign In Error:", err);
      let message = isAr ? 'فشل تسجيل الدخول باستخدام Google' : 'Google sign in failed';
      if (err.code === 'auth/account-exists-with-different-credential') {
        message = isAr ? 'الحساب موجود بالفعل بطريقة تسجيل دخول مختلفة' : 'Account exists with different credential';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto py-12"
    >
      <div className="bg-solar-card rounded-[40px] p-8 md:p-10 border border-solar-border shadow-2xl shadow-solar-blue/10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-solar-blue text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-solar-blue/30 rotate-3 text-solar-text">
            <LogIn size={32} />
          </div>
          <h2 className="text-3xl font-black text-solar-text mb-2">{t.welcomeBack}</h2>
          <p className="text-solar-muted text-sm px-4">{t.loginDesc}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{t.email}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition shadow-sm font-bold text-sm text-solar-text"
                placeholder="name@company.com" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2 tracking-widest">{t.password}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-solar-bg border border-solar-border rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-solar-blue transition shadow-sm font-bold text-sm text-solar-text"
                placeholder="••••••••" 
              />
            </div>
          </div>

          <SecurityCaptcha lang={lang} onVerify={setCaptchaVerified} />

          {error && <p className="text-solar-danger text-xs font-bold text-center bg-solar-danger/10 py-2 rounded-lg border border-solar-danger/20 px-3">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-solar-blue text-white py-4 rounded-xl font-black hover:bg-opacity-90 shadow-xl shadow-solar-blue/20 transition-all active:scale-95 flex items-center justify-center gap-2 group text-sm"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
              <>
                {t.login}
                <ArrowRight size={18} className={`group-hover:translate-x-1 transition-transform ${isAr ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </>
            )}
          </button>

          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-solar-border"></div>
            <span className="px-3 text-xs text-solar-muted font-bold">{isAr ? 'أو' : 'OR'}</span>
            <div className="flex-1 border-t border-solar-border"></div>
          </div>

          <button 
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full bg-white text-solar-text border border-solar-border py-3.5 rounded-xl font-black hover:bg-slate-50 shadow-sm flex items-center justify-center gap-3 transition-all active:scale-95 text-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.37 3.65 1.41 7.54l3.88 3C6.22 7.74 8.88 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.45h6.45c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.38-4.88 3.38-8.5z" />
              <path fill="#FBBC05" d="M5.29 14.3C5.03 13.52 4.88 12.69 4.88 11.83c0-.86.15-1.69.41-2.47L1.41 6.36C.51 8.16 0 10.15 0 12.27c0 2.12.51 4.11 1.41 5.91l3.88-3.88z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.1.74-2.5 1.18-4.3 1.18-3.12 0-5.78-2.7-6.71-5.5l-3.88 3C3.37 20.35 7.35 23 12 23z" />
            </svg>
            {isAr ? 'تسجيل الدخول بواسطة Google' : 'Sign in with Google'}
          </button>
        </form>

        <div className="mt-8 text-center pt-8 border-t border-solar-border">
          <p className="text-xs text-solar-muted font-bold">
            {t.dontHaveAccount} <button onClick={() => setView('register')} className="text-solar-blue font-black hover:underline">{t.register}</button>
          </p>
        </div>
      </div>
    </motion.div>
  );
};
