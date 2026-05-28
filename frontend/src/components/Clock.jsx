import { useEffect, useState } from 'react';

/**
 * Realtime clock di topbar. Update tiap detik dengan locale id-ID.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    function tick() {
      setNow(new Date());
    }
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const aria = `${dateLabel} - ${timeLabel}`;

  return (
    <span className="topbar-clock" id="realtime-clock" title={aria} aria-label={aria}>
      <svg className="topbar-clock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="topbar-clock-time">{timeLabel}</span>
    </span>
  );
}
