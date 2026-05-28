import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PasswordField } from '../components/PasswordToggle';
import { useAuth } from '../context/AuthContext';
import { AuthPageLayout } from '../layout/AuthPageLayout';
import { forgotPassword, login, resetPassword } from '../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  // ---- Form login ----
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // ---- Forgot password panel ----
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(false); // false = belum kirim, true = sudah, isi OTP+password
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingForgot, setSubmittingForgot] = useState(false);

  // ---- Feedback umum (login & forgot pakai field yang sama di HTML lama) ----
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Prefill email dari sessionStorage (set oleh halaman register setelah signup)
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem('lf_prefill_email');
      if (prefill) {
        setEmail(prefill);
        sessionStorage.removeItem('lf_prefill_email');
      }
    } catch (_) {
      // sessionStorage tidak tersedia di beberapa konteks
    }
  }, []);

  function setMsg(message, type) {
    setFeedback({ message, type });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setMsg('Email dan password wajib diisi.', 'error');
      return;
    }

    setSubmittingLogin(true);
    setMsg('', '');

    const { ok, status, data } = await login(trimmedEmail, trimmedPassword);

    if (!ok) {
      const detail =
        status === 401
          ? 'Username atau password salah.'
          : data.detail || `Login gagal (HTTP ${status}).`;
      setMsg(detail, 'error');
      setSubmittingLogin(false);
      return;
    }

    signIn({
      access_token: data.access_token || '',
      token_type: data.token_type || 'bearer',
      user: data.user || null,
    });
    setMsg('Login berhasil. Mengarahkan ke dashboard...', 'success');

    const redirectTo = location.state?.from?.pathname || '/dashboard';
    navigate(redirectTo, { replace: true });
  }

  function toggleForgot() {
    setForgotOpen((open) => {
      const next = !open;
      if (next) {
        setForgotEmail(email.trim());
        setForgotStep(false);
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setFeedback({ message: '', type: '' });
      }
      return next;
    });
  }

  async function handleForgot() {
    const identifier = (forgotEmail || email).trim();
    if (!identifier) {
      setMsg('Masukkan email akun terlebih dahulu.', 'error');
      return;
    }

    // Step 1: minta OTP via email
    if (!forgotStep) {
      setSubmittingForgot(true);
      const { ok, status, data } = await forgotPassword(identifier);
      setSubmittingForgot(false);

      if (!ok) {
        setMsg(data.detail || `Gagal kirim reset (HTTP ${status}).`, 'error');
        return;
      }

      setForgotStep(true);
      setMsg(
        data.note
          ? 'Kode reset tersedia untuk pengujian. Lanjutkan dengan mengisi password baru.'
          : 'Link reset telah dikirim ke email. Masukkan kode reset lalu perbarui password Anda.',
        'success',
      );
      return;
    }

    // Step 2: verifikasi OTP + ganti password
    const tokenTrim = otpCode.trim();
    if (!tokenTrim) {
      setMsg('Masukkan kode reset password.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(tokenTrim)) {
      setMsg('Kode reset harus 6 digit angka.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      setMsg('Password baru minimal 6 karakter.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg('Ulangi password belum sama.', 'error');
      return;
    }

    setSubmittingForgot(true);
    const { ok, status, data } = await resetPassword(tokenTrim, newPassword);
    setSubmittingForgot(false);

    if (!ok) {
      setMsg(data.detail || `Reset password gagal (HTTP ${status}).`, 'error');
      return;
    }
    setMsg(data.message || 'Password berhasil diperbarui. Silakan login.', 'success');
    // Reset state forgot panel supaya kalau dipakai lagi tidak ada sisa
    setForgotStep(false);
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <AuthPageLayout>
      <main className="login-shell" aria-labelledby="login-title">
        <section className="login-card login-card-center" aria-label="Form login">
          <div className="login-intro">
            <h1 id="login-title">Masuk Akun</h1>
            <p>Monitoring kebun LoRa dalam satu akses.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="login-email">Email atau Username</label>
              <input
                className="form-control"
                type="text"
                id="login-email"
                name="email"
                autoComplete="username"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <PasswordField
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Masukkan password"
                required
              />
            </div>

            <button
              className="btn btn-primary login-submit"
              type="submit"
              disabled={submittingLogin}
              aria-busy={submittingLogin || undefined}
            >
              <svg className="login-submit-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
              <span>Masuk</span>
            </button>

            <button
              className="forgot-link"
              type="button"
              aria-expanded={forgotOpen}
              aria-controls="forgot-panel"
              onClick={toggleForgot}
            >
              Lupa Password?
            </button>

            <section
              className="forgot-panel"
              id="forgot-panel"
              aria-label="Atur ulang password"
              hidden={!forgotOpen}
            >
              <div className="form-group">
                <label htmlFor="forgot-email">Email Akun</label>
                <input
                  className="form-control"
                  type="email"
                  id="forgot-email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>

              <div className="form-group" hidden={!forgotStep}>
                <label htmlFor="forgot-code">Kode Reset (6 Digit)</label>
                <input
                  className="form-control"
                  type="text"
                  id="forgot-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Masukkan kode 6 digit dari email"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>

              <div className="form-group forgot-reset-field" hidden={!forgotStep}>
                <label htmlFor="forgot-new-password">Password Baru</label>
                <input
                  className="form-control"
                  type="password"
                  id="forgot-new-password"
                  autoComplete="new-password"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group forgot-reset-field" hidden={!forgotStep}>
                <label htmlFor="forgot-confirm-password">Ulangi Password</label>
                <input
                  className="form-control"
                  type="password"
                  id="forgot-confirm-password"
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                className="btn btn-secondary forgot-submit"
                type="button"
                disabled={submittingForgot}
                aria-busy={submittingForgot || undefined}
                onClick={handleForgot}
              >
                {forgotStep ? 'Perbarui Password' : 'Kirim Link Reset'}
              </button>

              {feedback.message ? (
                <p
                  className={`forgot-feedback forgot-feedback-${feedback.type}`}
                  role="status"
                  aria-live="polite"
                >
                  {feedback.message}
                </p>
              ) : null}
            </section>

            {/* Feedback untuk login juga muncul di sini kalau forgot panel tertutup */}
            {!forgotOpen && feedback.message ? (
              <p
                className={`forgot-feedback forgot-feedback-${feedback.type}`}
                role="status"
                aria-live="polite"
              >
                {feedback.message}
              </p>
            ) : null}

            <div className="auth-divider" aria-hidden="true">
              <span>atau</span>
            </div>

            <p className="auth-switch">
              Belum punya akun?{' '}
              <Link className="auth-switch-link" to="/register">
                Daftar Akun
              </Link>
            </p>
          </form>
        </section>
      </main>
    </AuthPageLayout>
  );
}
