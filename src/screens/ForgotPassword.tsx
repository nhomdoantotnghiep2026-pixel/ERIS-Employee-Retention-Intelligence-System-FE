import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage, requestPasswordReset, resetPassword } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [busy, setBusy] = useState(false);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await requestPasswordReset(email.trim());
      setStep('reset');
      setMessage('Nếu email đủ điều kiện, mã OTP đã được gửi. Hãy kiểm tra hộp thư và nhập mã để đặt lại mật khẩu.');
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể gửi yêu cầu. Vui lòng thử lại.')); }
    finally { setBusy(false); }
  }

  async function submitReset(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await resetPassword(email.trim(), otp.trim(), newPassword);
      setOtp(''); setNewPassword('');
      navigate('/login', { replace: true });
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra OTP và thử lại.')); }
    finally { setBusy(false); }
  }

  async function resendOtp() {
    setBusy(true); setError(''); setMessage('');
    try {
      await requestPasswordReset(email.trim());
      setMessage('Đã gửi lại yêu cầu OTP. Hãy kiểm tra hộp thư và cả thư mục Spam.');
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể gửi lại OTP. Vui lòng thử lại sau.')); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-[#fbfbfd] px-5 py-8 text-slate-700">
    <section className="w-full max-w-[520px] rounded-[28px] bg-white p-6 shadow-[0_18px_55px_rgba(31,41,55,0.1)] sm:p-10">
      <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-500 hover:bg-orange-50 hover:text-orange-700"><ArrowLeft size={16}/>{t("Quay lại đăng nhập")}</Link>
      <div className="mt-7 flex items-start gap-3 rounded-2xl bg-orange-50 p-4"><ShieldCheck className="mt-0.5 shrink-0 text-orange-600" size={20}/><div><h1 className="font-bold text-slate-900">{t("Khôi phục mật khẩu")}</h1><p className="mt-1 text-sm leading-5 text-slate-600">{t("Nhập email tài khoản để nhận mã OTP đặt lại mật khẩu.")}</p></div></div>
      {step === 'email' ? <form onSubmit={sendOtp} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">{t("Email tài khoản")}<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" placeholder="you@example.com"/></div></label><button disabled={busy} className="h-12 w-full rounded-full bg-gradient-to-r from-[#fa8b2e] to-[#ef6827] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{t(busy ? 'Đang gửi OTP...' : 'Gửi mã OTP')}</button></form> : <form onSubmit={submitReset} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">{t("Mã OTP")}<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"/></label><label className="block text-sm font-semibold text-slate-700">{t("Mật khẩu mới")}<div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input required type={t(showPassword ? 'text' : 'password')} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 px-10 pr-12 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"/><button type="button" aria-label={t(showPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới')} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-orange-50">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div><span className="mt-1 block text-xs font-normal text-slate-400">{t("Ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.")}</span></label><button disabled={busy} className="h-12 w-full rounded-full bg-gradient-to-r from-[#fa8b2e] to-[#ef6827] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{t(busy ? 'Đang đặt lại...' : 'Đặt lại mật khẩu')}</button><button type="button" disabled={busy} onClick={() => void resendOtp()} className="min-h-11 w-full text-sm font-semibold text-orange-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50">{t(busy ? 'Đang gửi lại OTP...' : 'Gửi lại mã OTP')}</button></form>}
      {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">{t(message)}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-700">{t(error)}</p>}
    </section>
  </main>;
}
