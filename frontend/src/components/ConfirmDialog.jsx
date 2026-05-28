import { useEffect, useRef } from 'react';

/**
 * Modal konfirmasi generik (dipakai untuk delete kebun).
 *
 * Props:
 *   open       — bool, kontrol visibility
 *   title      — string title modal
 *   body       — string/node konten body
 *   confirmLabel
 *   cancelLabel
 *   confirmClass — class CSS untuk tombol konfirm (default btn-danger)
 *   onConfirm()
 *   onCancel()
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  confirmClass = 'btn btn-danger',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  // Auto-focus tombol cancel saat dialog muncul (UX standar).
  useEffect(() => {
    if (open && cancelRef.current) cancelRef.current.focus();
  }, [open]);

  // ESC menutup dialog.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape' && onCancel) onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && onCancel) onCancel();
  }

  return (
    <div
      className="confirm-overlay"
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
      onClick={handleBackdropClick}
    >
      <div className="confirm-dialog">
        <h3 className="confirm-title" id="confirm-dialog-title">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {title}
        </h3>
        <p className="confirm-body">{body}</p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel} ref={cancelRef}>
            {cancelLabel}
          </button>
          <button className={confirmClass} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
