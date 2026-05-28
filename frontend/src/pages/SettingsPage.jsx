import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getMe, updateProfile } from '../services/api';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signIn, signOut } = useAuth();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState({ message: '', type: '' });

  // Hydrate user dari backend (kalau token masih valid). Kalau gagal,
  // pakai data localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, status, data } = await getMe();
      if (cancelled) return;
      if (!ok) {
        if (status === 401) {
          signOut();
          navigate('/login', { replace: true });
        }
        return;
      }
      // Re-save via signIn supaya context + localStorage sync (preserve token).
      try {
        const token = localStorage.getItem('lf_access_token') || '';
        const tokenType = localStorage.getItem('lf_token_type') || 'bearer';
        signIn({ access_token: token, token_type: tokenType, user: data });
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEditPhone() {
    setPhoneInput(user?.phone || '');
    setPhoneFeedback({ message: '', type: '' });
    setEditingPhone(true);
  }

  function cancelEditPhone() {
    setEditingPhone(false);
    setPhoneFeedback({ message: '', type: '' });
  }

  async function savePhone() {
    setSavingPhone(true);
    const phone = phoneInput.trim();
    const { ok, status, data } = await updateProfile(phone);
    setSavingPhone(false);

    if (!ok) {
      if (status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      setPhoneFeedback({ message: data.detail || 'Gagal menyimpan.', type: 'error' });
      return;
    }

    const updatedUser = data.user || { ...user, phone };
    try {
      const token = localStorage.getItem('lf_access_token') || '';
      const tokenType = localStorage.getItem('lf_token_type') || 'bearer';
      signIn({ access_token: token, token_type: tokenType, user: updatedUser });
    } catch (_) {}
    setEditingPhone(false);
    setPhoneFeedback({ message: '', type: '' });
  }

  function handleLogout() {
    signOut();
    navigate('/login', { replace: true });
  }

  function handleChangePassword() {
    navigate('/change-password');
  }

  return (
    <DashboardLayout>
      <div className="settings-page">
        <section className="settings-section" aria-labelledby="settings-profile-title">
          <h3 className="settings-section-title" id="settings-profile-title">
            Profil Akun
          </h3>
          <div className="settings-profile-flat">
            <div className="settings-field">
              <span className="settings-field-label">Nama</span>
              <span className="settings-field-value">{user?.name || 'Tidak tersedia'}</span>
            </div>
            <div className="settings-field">
              <span className="settings-field-label">Email</span>
              <span className="settings-field-value">{user?.email || 'Tidak tersedia'}</span>
            </div>
            <div className="settings-field settings-field-editable">
              <span className="settings-field-label">Nomor Handphone</span>
              {editingPhone ? (
                <div className="settings-phone-row settings-phone-edit-row">
                  <input
                    className="form-control settings-phone-input"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Contoh: 08123456789"
                    maxLength={20}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={savePhone}
                    disabled={savingPhone}
                    aria-busy={savingPhone || undefined}
                  >
                    Simpan
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={cancelEditPhone}
                    disabled={savingPhone}
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <div className="settings-phone-row">
                  <span className="settings-field-value">{user?.phone || '-'}</span>
                  <button
                    className="settings-edit-btn"
                    type="button"
                    onClick={startEditPhone}
                    aria-label="Edit nomor handphone"
                  >
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                </div>
              )}
              {phoneFeedback.message ? (
                <p className={`settings-phone-feedback forgot-feedback-${phoneFeedback.type}`}>
                  {phoneFeedback.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="settings-actions settings-profile-actions">
            <button className="btn btn-secondary" type="button" onClick={handleChangePassword}>
              <i className="fas fa-key" aria-hidden="true" /> Ganti Sandi
            </button>
            <button className="btn btn-danger" type="button" onClick={handleLogout}>
              <i className="fas fa-right-from-bracket" aria-hidden="true" /> Keluar
            </button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
