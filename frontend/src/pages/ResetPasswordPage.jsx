import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordField } from '../components/PasswordToggle';
import { AuthPageLayout } from '../layout/AuthPageLayout';
import { resetPassword, resetPasswordVerify } from '../services/api';

export function ResetPasswordPage() {
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  function setMsg(message, type) {
    setFeedback({ message, type });
  }

  function backToCodeStep() {
    setCodeVerified(false);
    setVerifiedToken('');
    setPassword('');
    setConfirm('');
    setMsg('Masukkan kode reset yang benar, lalu verifikasi kembali.', 'success');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const tokenTrim = token.trim();
    if (!tokenTrim) {
      setMsg('Kode reset wajib diisi.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(tokenTrim)) {
      setMsg('Kode reset harus 6 digit angka.', 'error');
      return;
    }

    setSubmitting(true);

    if (!codeVerified) {
      const { ok, status, data } = await resetPasswordVerify(tokenTrim);
      setSubmitting(false);
      if (!ok) {
        setMsg(data.detail || `Proses reset gagal (HTTP ${status}).`, 'error');
        return;
      }
      setCodeVerified(true);
      setVerifiedToken(tokenTrim);
      setMsg('Kode valid. Silakan masukkan password baru Anda.', 'success');
      return;
    }

    if (password.length < 6) {
      setSubmitting(false);
      setMsg('Password baru minimal 6 karakter.', 'error');
      return;
    }
    if (password !== confirm) {
      setSubmitting(false);
      setMsg('Konfirmasi password belum sama.', 'error');
      return;
    }

    const { ok, status, data } = await resetPassword(verifiedToken, password);
    setSubmitting(false);
    if (!ok) {
      setMsg(data.detail || `Proses reset gagal (HTTP ${status}).`, 'error');
      return;
    }
    setMsg('Password berhasil diperbarui. Mengarahkan ke halaman masuk...', 'success');
    setTimeout(() => navigate('/login', { replace: true }), 1200);
  }

  return (
    <AuthPageLayout>
      <main className="login-shell" aria-labelledby="reset-title">
        <section className="login-card login-card-center" aria-label="Form reset password">
          <div className="login-intro">
            <h1 id="reset-title">Atur Ulang Password</h1>
            <p>Verifikasi kode reset 6 digit terlebih dahulu, lalu buat password baru Anda.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reset-token">Kode Reset (6 Digit)</label>
              <input
                className="form-control"
                type="text"
                id="reset-token"
                name="token"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="Contoh: 123456"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                readOnly={codeVerified}
                required
              />
            </div>

            {codeVerified ? (
              <button className="forgot-link" type="button" onClick={backToCodeStep}>
                Ganti Kode
              </button>
            ) : null}

            {codeVerified ? (
              <section>
                <div className="form-group">
                  <label htmlFor="reset-password">Password Baru</label>
                  <PasswordField
                    id="reset-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reset-confirm-password">Ulangi Password Baru</label>
                  <PasswordField
                    id="reset-confirm-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Ulangi password baru"
                  />
                </div>
              </section>
            ) : null}

            <button
              className="btn btn-primary login-submit"
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              <span>{codeVerified ? 'Perbarui Password' : 'Verifikasi Kode'}</span>
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
              Kembali ke <Link className="auth-switch-link" to="/login">Masuk</Link>
            </p>
          </form>
        </section>
      </main>
    </AuthPageLayout>
  );
}
