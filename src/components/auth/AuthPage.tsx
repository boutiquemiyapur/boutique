import React, { useState } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { BrandMark } from '../../config/brand';

type Mode = 'login' | 'register' | 'forgot';

const imageUrl = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1500&q=85';

export const AuthPage: React.FC<{ mode: Mode }> = ({ mode: initialMode }) => {
  const { login, register, requestPasswordReset, completeAuthentication, navigate, authStatus } = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const changeMode = (next: Mode) => { setMode(next); setError(''); setNotice(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setIsSubmitting(true);
    try {
      if (mode === 'login') { await login(email, password, remember); completeAuthentication(); }
      else if (mode === 'register') { await register(name, email, phone, password); completeAuthentication(); }
      else { await requestPasswordReset(email); setNotice('If an account exists, a password-reset email has been sent.'); }
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Please try again.'); }
    finally { setIsSubmitting(false); }
  };

  const title = mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Your Account' : 'Reset Password';
  const subtitle = mode === 'login' ? 'Enter your details to access your account.' : mode === 'register' ? 'Create an account to save your selections and measurements.' : 'Enter your email and we will send a secure reset link.';

  if (authStatus === 'loading') return <div className="grid min-h-[70vh] place-items-center bg-[#fbf9f7]"><LoaderCircle className="h-6 w-6 animate-spin text-[#685c53]" /></div>;
  return <div className="min-h-screen bg-[#fbf9f7] p-0 lg:grid lg:place-items-center lg:p-8"><section className="grid min-h-screen w-full max-w-[1280px] overflow-hidden border border-[#d0c4bc] bg-white lg:min-h-[80vh] lg:grid-cols-2">
    <div className="relative hidden min-h-full overflow-hidden lg:block"><img src={imageUrl} alt="AB Collection" className="absolute inset-0 h-full w-full object-cover grayscale-[25%]" /><div className="absolute inset-0 bg-[#30302f]/20" /><button onClick={() => navigate('home')} className="absolute left-8 top-8"><BrandMark inverse className="text-4xl" /></button></div>
    <div className="flex min-h-screen flex-col justify-center px-7 py-12 sm:px-14 lg:min-h-0 lg:px-20"><button onClick={() => navigate('home')} className="mb-12 self-start lg:hidden"><BrandMark className="text-2xl" /></button><div className="mx-auto w-full max-w-md"><div className="mb-10"><h1 className="font-serif text-4xl text-[#1b1c1b]">{title}</h1><p className="mt-3 text-base text-[#4d453f]">{subtitle}</p></div>{error && <div role="alert" className="mb-5 border border-[#ba1a1a]/30 bg-[#ffdad6]/50 p-3 text-sm text-[#93000a]">{error}</div>}{notice && <div role="status" className="mb-5 border border-[#685c53]/30 bg-[#f5f3f1] p-3 text-sm text-[#4f453c]">{notice}</div>}
      <form onSubmit={submit} className="space-y-7">
        {mode === 'register' && <><Field label="Full Name" value={name} onChange={setName} placeholder="Your name" required /><Field label="Phone Number" value={phone} onChange={setPhone} placeholder="Optional" /></>}
        <Field label="Email" value={email} onChange={setEmail} placeholder="your@email.com" required type="email" />
        {mode !== 'forgot' && <div><div className="mb-1 flex items-center justify-between"><label htmlFor="auth-password" className="text-xs font-semibold uppercase tracking-[.12em] text-[#4d453f]">Password</label>{mode === 'login' && <button type="button" onClick={() => changeMode('forgot')} className="text-xs tracking-[.08em] text-[#4d453f] hover:underline">Forgot Password?</button>}</div><div className="relative"><input id="auth-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="w-full border-0 border-b border-[#d0c4bc] bg-transparent px-0 py-3 pr-10 text-base outline-none focus:border-[#685c53]" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} className="absolute right-0 top-2.5 text-[#615e5c]" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>}
        {mode === 'login' && <label className="flex items-center gap-2 text-sm text-[#4d453f]"><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" className="h-4 w-4 border-[#d0c4bc] accent-[#685c53]" />Remember me</label>}
        <button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 bg-[#685c53] py-4 text-sm font-semibold uppercase tracking-[.08em] text-white disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{mode === 'login' ? 'Login' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}</button>
      </form>
      {mode !== 'forgot' && <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-[.12em] text-[#615e5c]"><span className="h-px flex-1 bg-[#d0c4bc]" />or<span className="h-px flex-1 bg-[#d0c4bc]" /></div>}
      {mode === 'login' && <button onClick={() => navigate('home')} className="w-full border border-[#685c53] py-4 text-sm uppercase tracking-[.08em] text-[#615e5c]">Continue as Guest</button>}
      <p className="mt-10 text-center text-sm text-[#4d453f]">{mode === 'login' ? <>Don't have an account? <button onClick={() => changeMode('register')} className="ml-1 underline underline-offset-4">Sign Up</button></> : mode === 'register' ? <>Already have an account? <button onClick={() => changeMode('login')} className="ml-1 underline underline-offset-4">Login</button></> : <button onClick={() => changeMode('login')} className="underline underline-offset-4">Return to login</button>}</p>
    </div></div></section></div>;
};

const Field = ({ label, value, onChange, placeholder, required, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; type?: string }) => <div><label className="text-xs font-semibold uppercase tracking-[.12em] text-[#4d453f]">{label}</label><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} className="mt-1 w-full border-0 border-b border-[#d0c4bc] bg-transparent px-0 py-3 text-base outline-none focus:border-[#685c53]" /></div>;
