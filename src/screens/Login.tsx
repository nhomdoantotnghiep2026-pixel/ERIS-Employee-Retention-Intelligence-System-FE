import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import { useRole, type UserRole } from '../context/RoleContext';
import { useLanguage } from '../context/LanguageContext';
import { changePassword, getApiErrorMessage, getCurrentUser, login } from '../services/api';
import { isManualPasswordEdit } from '../utils/manualPassword';

const ROLE_HOME: Record<UserRole, string> = {
  HR: '/dashboard',
  'Data / AI Analyst': '/data-overview',
  'System Administrator': '/admin-overview',
  'Employee / ESS': '/employee-dashboard',
};

const LOGIN_SLIDES = [
  {
    src: '/login-slides/hr-welcome.png',
    alt: 'Đội ngũ nhân sự chào đón một thành viên mới',
    title: 'Kết nối con người',
    description: 'Tạo trải nghiệm nhân sự gần gũi từ ngày đầu tiên.',
  },
  {
    src: '/login-slides/hr-collaboration.png',
    alt: 'Đồng nghiệp phối hợp trong không gian làm việc',
    title: 'Thấu hiểu đội ngũ',
    description: 'Lắng nghe, đồng hành và xây dựng môi trường làm việc tích cực.',
  },
  {
    src: '/login-slides/hr-leadership.png',
    alt: 'Quản lý nhân sự trong văn phòng hiện đại',
    title: 'Ra quyết định bằng dữ liệu',
    description: 'Phát hiện rủi ro sớm và giữ chân nhân tài đúng thời điểm.',
  },
] as const;

function ErisMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative shrink-0" aria-hidden="true">
      <div
        className={`flex items-center justify-center rounded-full border-[3px] border-[#f47b20] bg-white font-bold text-[#f47b20] ${
          compact ? 'h-14 w-14 text-lg' : 'h-16 w-16 text-xl'
        }`}
      >
        e
      </div>
      <span className="absolute -right-0.5 -top-1 grid h-6 w-7 -rotate-[28deg] place-items-center rounded-full bg-[#55b86a] text-white">
        <Leaf size={14} strokeWidth={2.4} />
      </span>
    </div>
  );
}

export default function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser } = useRole();
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordEditable, setPasswordEditable] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const clearPasswords = () => {
      setPassword(''); setShowPass(false); setPasswordEditable(false);
      setNewPassword(''); setConfirmPassword(''); setOtp(''); setPasswordChangeToken('');
      if (passwordInput.current) passwordInput.current.value = '';
    };
    clearPasswords();
    window.addEventListener('pageshow', clearPasswords);
    return () => window.removeEventListener('pageshow', clearPasswords);
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate(ROLE_HOME[user.role], { replace: true });
  }, [isAuthenticated, navigate, user.role]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % LOGIN_SLIDES.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  function mapApiRole(role?: string | { name: string }, roleId?: number): UserRole {
    const normalized = (typeof role === 'string' ? role : role?.name)?.trim().toUpperCase();
    if (normalized === 'ADMIN' || normalized === 'SYSTEM ADMINISTRATOR') return 'System Administrator';
    if (normalized === 'HR') return 'HR';
    if (normalized === 'ANALYST' || normalized === 'DATA / AI ANALYST' || normalized === 'DATA_ANALYST') return 'Data / AI Analyst';
    if (roleId === 1) return 'System Administrator';
    if (roleId === 2) return 'HR';
    return 'Employee / ESS';
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const loginResult = await login(loginEmail.trim(), password);
      if (loginResult.passwordChangeToken) {
        setPasswordChangeToken(loginResult.passwordChangeToken);
        setError('Mã OTP đổi mật khẩu đã được gửi tới email của tài khoản.');
        return;
      }
      const apiUser = await getCurrentUser();
      setPassword(''); setShowPass(false);
      const nextUser = {
        name: apiUser.fullName || apiUser.email,
        email: apiUser.email,
        role: mapApiRole(apiUser.role, apiUser.roleId),
        initials: (apiUser.fullName || apiUser.email)
          .split(/\s+/)
          .map((part) => part[0])
          .join('')
          .slice(-2)
          .toUpperCase(),
      };
      setUser(nextUser);
      navigate(ROLE_HOME[nextUser.role]);
    } catch (loginError) {
      sessionStorage.removeItem('eris-access-token');
      setError(getApiErrorMessage(loginError, 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(passwordChangeToken, password, otp, newPassword);
      setPasswordChangeToken('');
      setOtp('');
      setPassword(''); setShowPass(false); setPasswordEditable(false); setShowNewPass(false); setShowConfirmPass(false);
      setNewPassword('');
      setConfirmPassword('');
      setError('Đổi mật khẩu thành công. Bấm Đăng nhập để tiếp tục.');
    } catch (changeError) {
      setError(getApiErrorMessage(changeError, 'Đổi mật khẩu thất bại. Vui lòng kiểm tra OTP và thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#fbfbfd] text-slate-700">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[#ffad37] to-[#ef6426] opacity-95 lg:hidden"
      />

      <aside
        aria-label={t('Câu chuyện về trải nghiệm nhân sự')}
        className="absolute inset-y-0 right-0 hidden w-[43%] overflow-hidden bg-[#ef7428] lg:block"
        style={{ clipPath: 'ellipse(100% 94% at 100% 50%)' }}
      >
        {LOGIN_SLIDES.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={t(slide.alt)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out motion-reduce:transition-none ${
              index === activeSlide ? 'scale-105 opacity-100' : 'scale-100 opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-[#9b3817]/90 via-[#e86124]/45 to-[#f69236]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.18),transparent_35%)]" />

        <div className="absolute bottom-[11%] right-[7%] w-[64%] text-right text-white xl:right-[9%] xl:w-[58%]">
          <div className="transition-all duration-500 motion-reduce:transition-none" key={LOGIN_SLIDES[activeSlide].title}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">{t('ERIS · People experience')}</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight xl:text-3xl">{t(LOGIN_SLIDES[activeSlide].title)}</h2>
            <p className="ml-auto mt-3 max-w-[360px] text-sm leading-6 text-white/85 xl:text-base">
              {t(LOGIN_SLIDES[activeSlide].description)}
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-2" aria-label={t('Chọn ảnh giới thiệu')}>
            {LOGIN_SLIDES.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                aria-label={t('Hiển thị ảnh {number}: {title}', { number: index + 1, title: t(slide.title) })}
                aria-pressed={index === activeSlide}
                onClick={() => setActiveSlide(index)}
                className={`h-2 rounded-full border border-white/80 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  index === activeSlide ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </aside>

      <section className="relative z-10 flex min-h-dvh w-full items-center px-5 py-8 sm:px-8 lg:w-[69%] lg:px-12 xl:w-[66%]">
        <div className="mx-auto w-full max-w-[590px]">
          <Link
            to="/"
            aria-label={t('Quay về trang giới thiệu ERIS')}
            className="group relative mb-7 flex items-center justify-center overflow-hidden rounded-[26px] border border-white bg-white/95 px-7 py-5 shadow-[0_18px_55px_rgba(31,41,55,0.10)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-[0_24px_65px_rgba(234,88,12,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 sm:px-10"
          >
            <span className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-orange-50 text-orange-700 opacity-70 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100 group-focus-visible:-translate-x-1 group-focus-visible:opacity-100 sm:left-6" aria-hidden="true">
              <ArrowLeft size={15} />
            </span>
            <span className="transition-transform duration-300 group-hover:scale-[1.03]">
              <ErisMark />
            </span>
            <div className="ml-4 border-l border-slate-200 pl-4 text-left">
              <div className="text-2xl font-bold tracking-[0.12em] text-slate-800">ERIS</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 sm:text-[11px]">
                {t('Employee Retention Intelligence System')}
              </div>
            </div>
            <span className="absolute inset-x-12 bottom-0 h-0.5 origin-center scale-x-0 bg-gradient-to-r from-transparent via-orange-500 to-transparent transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" aria-hidden="true" />
          </Link>

          <div className="px-1 sm:px-8">
            <div className="mb-5 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">{t('Đăng nhập')}</h1>
              <p className="mt-2 text-sm text-slate-500">{t('Truy cập không gian làm việc phù hợp với vai trò của bạn')}</p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off" noValidate hidden={Boolean(passwordChangeToken)}>
              <div>
                <label htmlFor="login-email" className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                  <UserRound size={15} />
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => {
                    setLoginEmail(event.target.value);
                    setPassword(''); setShowPass(false); setPasswordEditable(false);
                    setError('');
                  }}
                  placeholder={t('Nhập email tài khoản')}
                  autoComplete="username"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#f47b20] focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                  <LockKeyhole size={15} />
                  {t('Mật khẩu')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    ref={passwordInput}
                    readOnly={!passwordEditable}
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      if (!isManualPasswordEdit((event.nativeEvent as InputEvent).inputType)) {
                        event.target.value = password;
                        return;
                      }
                      setPassword(event.target.value);
                      setError('');
                    }}
                    onFocus={event => { event.target.value = password; setPasswordEditable(true); }}
                    onBeforeInput={event => {
                      if (event.currentTarget.value !== password) event.currentTarget.value = password;
                    }}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-base outline-none transition focus:border-[#f47b20] focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    aria-label={t(showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu')}
                    onClick={() => {
                      // Never reveal a value injected directly by a password manager.
                      if (passwordInput.current) passwordInput.current.value = password;
                      setShowPass((visible) => !visible);
                    }}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {error && (
                  <p id="login-error" role="alert" className="mt-2 text-xs font-semibold text-red-600">
                    {t(error)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-12 w-full rounded-full bg-gradient-to-r from-[#fa8b2e] to-[#ef6827] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(239,104,39,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(239,104,39,0.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 active:translate-y-0"
              >
                {t(isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập')}
              </button>
            </form>

            {passwordChangeToken && (
              <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
                <p className="rounded-xl bg-orange-50 p-4 text-sm leading-5 text-orange-800">
                  {t('Tài khoản mới cần đổi mật khẩu trước khi sử dụng. Nhập OTP trong email và đặt mật khẩu mới.')}
                </p>
                <div>
                  <label htmlFor="password-change-otp" className="mb-1.5 block text-[13px] font-medium text-slate-600">{t('Mã OTP')}</label>
                  <input id="password-change-otp" inputMode="numeric" maxLength={6} required value={otp} onChange={event => setOtp(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#f47b20] focus:ring-4 focus:ring-orange-100" />
                </div>
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-[13px] font-medium text-slate-600">{t('Mật khẩu mới')}</label>
                  <div className="relative">
                    <input id="new-password" type={showNewPass ? 'text' : 'password'} required value={newPassword} onChange={event => setNewPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-base outline-none focus:border-[#f47b20] focus:ring-4 focus:ring-orange-100" />
                    <button type="button" aria-label={t(showNewPass ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới')} onClick={() => setShowNewPass(value => !value)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-600">
                      {showNewPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{t('Ít nhất 12 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.')}</p>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-[13px] font-medium text-slate-600">{t('Xác nhận mật khẩu mới')}</label>
                  <div className="relative">
                    <input id="confirm-password" type={showConfirmPass ? 'text' : 'password'} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-base outline-none focus:border-[#f47b20] focus:ring-4 focus:ring-orange-100" />
                    <button type="button" aria-label={t(showConfirmPass ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu')} onClick={() => setShowConfirmPass(value => !value)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-600">
                      {showConfirmPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                {error && <p role="alert" className="text-xs font-semibold text-red-600">{t(error)}</p>}
                <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-full bg-gradient-to-r from-[#fa8b2e] to-[#ef6827] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(239,104,39,0.28)]">
                  {t(isSubmitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu')}
                </button>
              </form>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">
              {t('Tài khoản do doanh nghiệp cấp và quản lý. Liên hệ quản trị viên nếu bạn không thể đăng nhập.')}
            </p>
            <Link to="/forgot-password" className="mt-3 block text-center text-sm font-semibold text-orange-700 hover:underline">{t('Quên mật khẩu?')}</Link>
          </div>

          <footer className="mt-6 text-center text-[11px] text-slate-400">{t('© 2026 ERIS · Graduation Capstone Project')}</footer>
        </div>
      </section>

    </main>
  );
}
