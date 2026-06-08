import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordField } from '../components/PasswordToggle';
import { AuthPageLayout } from '../layout/AuthPageLayout';
import { register } from '../services/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  function setMsg(message, type) {
    setFeedback({ message, type });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setMsg('Nama lengkap wajib diisi.', 'error');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setMsg('Email belum valid.', 'error');
      return;
    }
    if (password.length < 6) {
      setMsg('Password minimal 6 karakter.', 'error');
      return;
    }
    if (password !== confirm) {
      setMsg('Ulangi password belum sama.', 'error');
      return;
    }

    setSubmitting(true);
    const { ok, status, data } = await register(trimmedName, trimmedEmail, password);
    setSubmitting(false);

    if (!ok) {
      setMsg(data.detail || `Gagal membuat akun (HTTP ${status}).`, 'error');
      return;
    }

    try {
      sessionStorage.setItem('lf_prefill_email', trimmedEmail);
    } catch (_) {}
    setMsg('Akun berhasil dibuat. Mengarahkan ke halaman masuk...', 'success');
    setTimeout(() => navigate('/login', { replace: true }), 1200);
  }

  return (
    <AuthPageLayout>
      <main className="login-shell" aria-labelledby="register-title">
        <section className="login-card login-card-center" aria-label="Form daftar akun">
          <div className="login-intro">
            <h1 id="register-title">Daftar Akun</h1>
            <p>Buat akun baru untuk akses dashboard LoraField.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="register-name">Nama Lengkap</label>
              <input
                className="form-control"
                type="text"
                id="register-name"
                name="name"
                autoComplete="name"
                placeholder="Nama lengkap kamu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-email">Email</label>
              <input
                className="form-control"
                type="email"
                id="register-email"
                name="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-password">Password</label>
              <PasswordField
                id="register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-confirm">Ulangi Password</label>
              <PasswordField
                id="register-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Ulangi password"
                required
              />
            </div>

            <button
              className="btn btn-primary login-submit"
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              <span>Buat Akun</span>
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

            <div className="auth-divider" aria-hidden="true">
              <span>atau</span>
            </div>

            <p className="auth-switch">
              Sudah punya akun?{' '}
              <Link className="auth-switch-link" to="/login">
                Masuk
              </Link>
            </p>
          </form>
        </section>
      </main>
    </AuthPageLayout>
  );
}

export default RegisterPage;
