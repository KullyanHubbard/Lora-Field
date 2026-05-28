import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarmContext } from '../hooks/useFarmContext';
import { getFarm } from '../services/api';

/**
 * Pill di topbar yang muncul cuma di farm-context (/farms/:id/*).
 * Menampilkan nama farm + label "Ganti Kebun". Klik → balik ke /dashboard.
 */
export function FarmSwitcher() {
  const { farmId, isFarmContext } = useFarmContext();
  const [farmName, setFarmName] = useState('');

  useEffect(() => {
    if (!isFarmContext || !farmId) {
      setFarmName('');
      return;
    }
    let cancelled = false;
    (async () => {
      const { ok, data } = await getFarm(farmId);
      if (cancelled) return;
      if (ok && data.farm) setFarmName(data.farm.name || farmId);
      else setFarmName(farmId);
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, isFarmContext]);

  if (!isFarmContext) return null;

  return (
    <Link className="farm-switcher" id="farm-switcher" to="/dashboard">
      <i className="fas fa-map-location-dot" aria-hidden="true" />
      <span className="farm-switcher-copy">
        <span className="farm-switcher-name">{farmName || 'Kebun'}</span>
        <span className="farm-switcher-action">Ganti Kebun</span>
      </span>
    </Link>
  );
}
