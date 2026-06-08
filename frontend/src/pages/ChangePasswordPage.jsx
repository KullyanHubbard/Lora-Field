import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordField } from '../components/PasswordToggle';
import { AuthPageLayout } from '../layout/AuthPageLayout';
import { changePassword } from '../services/api';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  function setMsg(message, type) {
    setFeedback({ message, type });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!currentPw) {
      setMsg('Password saat ini wajib diisi.', 'error');
      return;
    }
    if (newPw.length < 6) {
      setMsg('Password baru minimal 6 karakter.', 'error');
      return;
    }
    if (newPw === currentPw) {
      setMsg('Password baru tidak boleh sama dengan password lama.', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      setMsg('Konfirmasi password belum sama.', 'error');
      return;
    }

    setSubmitting(true);
    const { ok, status, data } = await changePassword(currentPw, newPw);
    setSubmitting(false);

    if (!ok) {
      if (status === 401) {
        // 401 dari backend = current password salah, BUKAN JWT expired (karena
        // change-password endpoint butuh JWT valid juga). Backend kasih detail
        // pesan yang tepat: "Password saat ini salah."
        setMsg(data.detail || 'Password saat ini salah.', 'error');
        return;
      }
      setMsg(data.detail || `Gagal mengganti password (HTTP ${status}).`, 'error');
      return;
    }

    setMsg('Password berhasil diperbarui. Mengarahkan ke pengaturan...', 'success');
    setTimeout(() => navigate('/settings', { replace: true }), 1400);
  }

  return (
    <AuthPageLayout showBrandBar={false}>
      <main className="login-shell" aria-labelledby="change-pw-title">
        <section className="login-card login-card-center" aria-label="Form ganti password">
          <div className="login-intro">
            <h1 id="change-pw-title">Ganti Password</h1>
            <p>Masukkan password baru untuk akun Anda.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="current-password">Password Saat Ini</label>
              <PasswordField
                id="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                placeholder="Masukkan password saat ini"
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">Password Baru</label>
              <PasswordField
                id="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Ulangi Password Baru</label>
              <PasswordField
                id="confirm-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                placeholder="Ulangi password baru"
              />
            </div>

            <button
              className="btn btn-primary login-submit"
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              Simpan Password Baru
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
              Kembali ke{' '}
              <Link className="auth-switch-link" to="/settings">
                Pengaturan
              </Link>
            </p>
          </form>
        </section>
      </main>
    </AuthPageLayout>
  );
}

export default ChangePasswordPage;
