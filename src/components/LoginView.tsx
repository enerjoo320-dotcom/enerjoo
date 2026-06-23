import React, { useState } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, ArrowRight, ShieldCheck, Check } from 'lucide-react';
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
  const [isNotAllowedError, setIsNotAllowedError] = useState(false);
  const [isPopupBlockedError, setIsPopupBlockedError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaVerified) {
      setError(isAr ? 'يرجى إكمال التحقق الأمني أولاً (أنا لست برنامج روبوت)' : "Please complete the security verification first (I'm not a robot)");
      return;
    }
    setLoading(true);
    setError('');
    setIsNotAllowedError(false);
    setIsPopupBlockedError(false);
    try {
      await login(email, password);
      setView('home');
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = isAr ? 'خطأ في البريد الإلكتروني أو كلمة المرور' : 'Invalid email or password';
      const isNotAllowed = error.code === 'auth/operation-not-allowed' || error.message?.includes('auth/operation-not-allowed');
      
      if (error.code === 'auth/user-not-found') message = isAr ? 'المستخدم غير موجود' : 'User not found';
      else if (error.code === 'auth/wrong-password') message = isAr ? 'كلمة مرور خاطئة' : 'Wrong password';
      else if (error.code === 'auth/invalid-credential') message = isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password credentials.';
      else if (error.code === 'auth/network-request-failed') message = isAr ? 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت' : 'Network error. Please check your internet connection or browser settings.';
      else if (isNotAllowed) {
        setIsNotAllowedError(true);
        message = isAr ? 'تسجيل الدخول بالبريد غير مفعّل في لوحة Firebase الخاصة بك حالياً.' : 'Email authentication is not enabled in your Firebase console.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    setIsPopupBlockedError(false);
    setIsNotAllowedError(false);
    try {
      await signInWithGoogle('customer');
      setView('home');
    } catch (err: any) {
      console.error("Google Sign In Error:", err);
      let message = isAr ? 'فشل تسجيل الدخول باستخدام Google' : 'Google sign in failed';
      const isPopupBlocked = err.code === 'auth/popup-blocked' || err.message?.includes('auth/popup-blocked');
      if (err.code === 'auth/account-exists-with-different-credential') {
        message = isAr ? 'الحساب موجود بالفعل بطريقة تسجيل دخول مختلفة' : 'Account exists with different credential';
      } else if (isPopupBlocked) {
        setIsPopupBlockedError(true);
        message = isAr 
          ? 'تم حظر نافذة تسجيل الدخول المنبثقة من قبل متصفحك.' 
          : 'Google sign-in popup was blocked by your browser.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-md mx-auto pb-20 font-sans px-4 Ltr:text-left rtl:text-right"
    >
      {/* Mockup TOP Header layout replication */}
      <div className="flex items-center justify-between mb-8">
        {/* Left side: Blue button block containing "تسجيل الدخول" and the icon */}
        <button 
          onClick={() => setView('login')}
          className="flex items-center gap-2 bg-solar-blue text-white px-5 py-2.5 rounded-2xl text-sm font-extrabold shadow-lg shadow-solar-blue/20 transition-all active:scale-95"
        >
          <LogIn size={18} className="stroke-[2.5]" />
          <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
        </button>

        {/* Right side: Circular blue badge containing letter "S" */}
        <div className="w-10 h-10 bg-solar-blue rounded-xl flex items-center justify-center shadow-lg shadow-solar-blue/20">
          <span className="text-white font-black text-xl font-display">S</span>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="bg-white rounded-[2.5rem] px-6 py-10 md:p-10 border border-solar-border/40 shadow-[0_15px_50px_rgba(0,0,0,0.03)] relative">
        
        {/* Styled overlaps/centering Icon Box */}
        <div className="w-20 h-20 bg-solar-blue text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-solar-blue/20">
          <LogIn size={36} className="stroke-[2]" />
        </div>

        {/* Headings */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-solar-text mb-2 tracking-tight">
            {isAr ? 'مرحباً بك مجدداً' : 'Welcome Back'}
          </h2>
          <p className="text-solar-muted text-sm font-bold opacity-80">
            {isAr ? 'أدخل بياناتك للوصول إلى حسابك' : 'Enter your credentials to access your account'}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Email input field */}
          <div className="space-y-1.5 text-right">
            <label className="text-[11px] font-extrabold text-solar-muted mr-1">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              {isAr ? (
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-solar-muted/60" size={18} />
              ) : (
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted/60" size={18} />
              )}
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-solar-bg border border-solar-border rounded-2xl py-4 ${
                  isAr ? 'pr-12 pl-4' : 'pl-12 pr-4'
                } outline-none focus:border-solar-blue/60 transition shadow-sm font-bold text-sm text-solar-text placeholder:text-solar-muted/45`}
                placeholder="name@company.com" 
              />
            </div>
          </div>

          {/* Password input field */}
          <div className="space-y-1.5 text-right">
            <label className="text-[11px] font-extrabold text-solar-muted mr-1">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              {isAr ? (
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-solar-muted/60" size={18} />
              ) : (
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-solar-muted/60" size={18} />
              )}
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-solar-bg border border-solar-border rounded-2xl py-4 ${
                  isAr ? 'pr-12 pl-4' : 'pl-12 pr-4'
                } outline-none focus:border-solar-blue/60 transition shadow-sm font-bold text-sm text-solar-text placeholder:text-solar-muted/45`}
                placeholder="••••••••" 
              />
            </div>
          </div>

          {/* Integrated Verification reCAPTCHA Container */}
          <SecurityCaptcha lang={lang} onVerify={setCaptchaVerified} />

          {error && (
            <div className="p-4 bg-solar-danger/10 text-solar-danger rounded-2xl text-xs font-bold border border-solar-danger/20 text-center space-y-2 leading-relaxed">
              <div>{error}</div>
              
              {isNotAllowedError && (
                <div className="p-3 bg-white rounded-xl border border-solar-danger/20 text-[10px] font-bold text-solar-muted text-right space-y-1.5">
                  <span className="text-amber-500 block">🎛️ تفعيل المصادقة في لوحة Firebase:</span>
                  <p>اذهب لـ Authentication ثم Sign-in method وقم بتمكين خيار Email/Password ثم احفظ التغييرات.</p>
                </div>
              )}

              {isPopupBlockedError && (
                <div className="p-3 bg-white rounded-xl border border-solar-danger/20 text-[10px] font-bold text-solar-muted text-right leading-relaxed">
                  <span>يرجى فتح التطبيق في نافذة مستقلة جديدة عبر النقر على زر السهم أعلى اليمين ثم إعادة تسجيل الدخول لتجنب قيود المتصفح الأمنية للـ iframe.</span>
                </div>
              )}
            </div>
          )}

          {/* Solid Blue submit styled button with leftward arrow */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-solar-blue text-white py-4 rounded-2xl font-black hover:bg-opacity-95 shadow-lg shadow-solar-blue/20 transition-all active:scale-95 flex items-center justify-center gap-2 group text-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <div className="flex items-center justify-center gap-2">
                {isAr ? (
                  <>
                    <ArrowLeft size={18} className="group-hover:-translate-x-1.5 transition-transform" />
                    <span>تسجيل الدخول</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                  </>
                )}
              </div>
            )}
          </button>

          {/* Divider with central Or text */}
          <div className="flex items-center py-2">
            <div className="flex-1 border-t border-solar-border/70"></div>
            <span className="px-3 text-xs text-solar-muted font-bold opacity-80">{isAr ? 'أو' : 'OR'}</span>
            <div className="flex-1 border-t border-solar-border/70"></div>
          </div>

          {/* Clean Google Single Sign-On Button with official assets */}
          <button 
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full bg-white text-solar-text border border-solar-border rounded-2xl py-4 font-black hover:bg-slate-50 shadow-sm flex items-center justify-center gap-3 transition-all active:scale-95 text-xs"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 1 12 1 7.35 1 3.37 3.65 1.41 7.54l3.88 3C6.22 7.74 8.88 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.45h6.45c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.38-4.88 3.38-8.5z" />
              <path fill="#FBBC05" d="M5.29 14.3C5.03 13.52 4.88 12.69 4.88 11.83c0-.86.15-1.69.41-2.47L1.41 6.36C.51 8.16 0 10.15 0 12.27c0 2.12.51 4.11 1.41 5.91l3.88-3.88z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.1.74-2.5 1.18-4.3 1.18-3.12 0-5.78-2.7-6.71-5.5l-3.88 3C3.37 20.35 7.35 23 12 23z" />
            </svg>
            <span>{isAr ? 'تسجيل الدخول بواسطة Google' : 'Sign in with Google'}</span>
          </button>
        </form>

        {/* Footer info/redirection */}
        <div className="mt-8 text-center pt-6 border-t border-solar-border/70">
          <p className="text-xs text-solar-muted font-bold">
            {t.dontHaveAccount} <button onClick={() => setView('register')} className="text-solar-blue font-black hover:underline">{t.register}</button>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

