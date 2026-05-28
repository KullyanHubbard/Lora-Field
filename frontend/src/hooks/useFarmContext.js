import { useLocation } from 'react-router-dom';

/**
 * Deteksi apakah user sedang di halaman farm-specific (/farms/:id/*).
 * /farms (list) dan /farms/add (form) BUKAN farm-context karena tidak
 * terkait dengan satu farm tertentu.
 *
 * Return: { farmId: string|null, isFarmContext: boolean }
 */
export function useFarmContext() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/farms\/([^/]+)(?:\/|$)/);
  const candidate = match ? match[1] : null;
  // Filter out non-farm-id segments yang ada di /farms/<segment>
  const reserved = new Set(['add', 'new']);
  const farmId = candidate && !reserved.has(candidate) ? candidate : null;
  return { farmId, isFarmContext: Boolean(farmId) };
}
