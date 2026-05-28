import { useState } from 'react';

/**
 * Field password dengan toggle show/hide.
 * Markup & class disamakan dengan login.html lama supaya styling
 * di style.css/premium.css tetap apply tanpa modifikasi CSS.
 */
export function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required = false,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-field">
      <input
        className="form-control password-input"
        type={show ? 'text' : 'password'}
        id={id}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
      />
      <button
        className="password-toggle"
        type="button"
        aria-pressed={show}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        onClick={() => setShow((s) => !s)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <g className={`icon-eye-open${show ? ' password-icon-state-hidden' : ''}`}>
            <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3.2" />
          </g>
          <g className={`icon-eye-closed${show ? '' : ' password-icon-state-hidden'}`}>
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.2 0 10 7 10 7a17.3 17.3 0 0 1-3.2 4.2" />
            <path d="M6.3 6.3A17 17 0 0 0 2 12s3.8 7 10 7c1.3 0 2.4-.2 3.5-.6" />
          </g>
        </svg>
      </button>
    </div>
  );
}
