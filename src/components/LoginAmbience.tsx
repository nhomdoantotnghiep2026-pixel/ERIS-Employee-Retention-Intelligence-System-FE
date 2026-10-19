import './LoginAmbience.css';

export function LoginAmbience() {
  return <div aria-hidden="true" className="login-ambience pointer-events-none absolute inset-y-0 left-0 w-full overflow-hidden lg:w-[65%]">
    <span className="login-ambient-orb login-ambient-orb--one" />
    <span className="login-ambient-orb login-ambient-orb--two" />
    <span className="login-ambient-orb login-ambient-orb--three" />
    <span className="login-ambient-orb login-ambient-orb--four" />
    <span className="login-ambient-orb login-ambient-orb--five" />
    <span className="login-ambient-glow" />
  </div>;
}
