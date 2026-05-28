import { useEffect } from 'react';

/**
 * Apply class ke document.body sepanjang komponen mount.
 * Dipakai untuk class global seperti `auth-page` yang men-trigger
 * background gradient di style.css.
 */
export function useBodyClass(className) {
  useEffect(() => {
    if (!className) return undefined;
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [className]);
}
