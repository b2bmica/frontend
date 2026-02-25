import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Mail, Lock, User, MapPin, Phone, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function AuthPage() {
  const { login, register, error, clearError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    hotelName: '',
    userName: '',
    email: '',
    password: '',
    address: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch {
      // error is handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    clearError();
  };

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-primary/10">
      {/* Left Side: Illustration & Branding */}
      <div className="hidden lg:flex w-1/2 bg-slate-50 relative p-12 flex-col justify-between overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/[0.03] rounded-full -mr-96 -mt-96" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/[0.02] rounded-full -ml-48 -mb-48" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Building2 className="h-6 w-6" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">InnLogix Systems</span>
          </div>
          
          <div className="space-y-6 max-w-md">
            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-slate-900">
               Engineering the future of <span className="text-primary italic">hospitality</span> management.
            </h1>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">
               A unified operating system for independent hotels, boutiques, and luxury resorts.
            </p>
          </div>
        </div>

        <div className="relative z-10">
           <div className="flex gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-4 flex-1">
                 <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck className="h-5 w-5" /></div>
                 <div><p className="text-[10px] font-black uppercase text-slate-400">Security</p><p className="font-bold text-sm">ISO Certified</p></div>
              </div>
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-4 flex-1">
                 <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Sparkles className="h-5 w-5" /></div>
                 <div><p className="text-[10px] font-black uppercase text-slate-400">Scale</p><p className="font-bold text-sm">Cloud Native</p></div>
              </div>
           </div>
           <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">© 2026 InnLogix Global Technologies Inc.</p>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
             <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white mb-6">
               <Building2 className="h-7 w-7" />
             </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {isLogin ? 'Sign In' : 'Register Property'}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              {isLogin ? 'Welcome back! Please enter your details.' : 'Create an account to manage your property.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {!isLogin ? (
                <motion.div 
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Property Legal Name</Label>
                    <Input 
                      required 
                      className="h-12 rounded-xl border-slate-200 focus:ring-primary font-bold"
                      value={form.hotelName}
                      onChange={e => setForm({ ...form, hotelName: e.target.value })}
                      placeholder="e.g. Grand Heritage Palace"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner/Admin</Label>
                      <Input 
                        required 
                        className="h-12 rounded-xl border-slate-200 focus:ring-primary font-bold"
                        value={form.userName}
                        onChange={e => setForm({ ...form, userName: e.target.value })}
                        placeholder="Your Name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Phone</Label>
                      <Input 
                        required 
                        className="h-12 rounded-xl border-slate-200 focus:ring-primary font-bold"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="+91..."
                      />
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</Label>
              <Input 
                type="email"
                required 
                className="h-12 rounded-xl border-slate-200 focus:ring-primary font-bold"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="admin@alphabank.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</Label>
                {isLogin && <button type="button" className="text-[10px] font-bold uppercase text-primary tracking-wider">Forgot?</button>}
              </div>
              <div className="relative">
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  required 
                  className="h-12 rounded-xl border-slate-200 focus:ring-primary font-black tracking-widest pr-10"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••••"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
                <InfoIcon className="h-5 w-5 shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? 'Sign In' : 'Create Property'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><Separator /></div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider"><span className="bg-white px-4 text-slate-300">OR</span></div>
          </div>

          <button
            onClick={toggleMode}
            className="w-full h-12 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-600 transition-colors"
          >
            {isLogin ? 'Register New Property' : 'Back to Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  )
}

function Separator() {
  return <div className="w-full h-px bg-slate-100" />
}
