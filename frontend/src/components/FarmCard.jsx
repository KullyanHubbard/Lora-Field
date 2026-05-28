import { formatAreaHa } from '../utils/farmHelpers';

/**
 * Card kebun. Markup & class disamakan dengan farm-card di HTML lama
 * supaya CSS dashboard.css/premium.css langsung apply.
 *
 * Props:
 *   farm        — object farm dari backend (id, name, owner, location, crop_type, area_ha)
 *   selected    — bool, kasih class `is-selected`
 *   onOpen()    — callback klik card / tombol "Buka Dashboard"
 *   onDelete()  — callback klik tombol hapus (kalau null, tombol tidak muncul)
 */
export function FarmCard({ farm, selected, onOpen, onDelete }) {
  function handleCardClick(event) {
    // Jangan trigger card click kalau klik di tombol/link di dalam card.
    if (event.target.closest('a, button')) return;
    if (onOpen) onOpen(farm);
  }

  function handleCardKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (onOpen) onOpen(farm);
  }

  return (
    <article
      className={`farm-card${selected ? ' is-selected' : ''}`}
      data-farm-card={farm.id}
      tabIndex={0}
      role="link"
      aria-label={`Buka dashboard ${farm.name}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
    >
      <div className="farm-card-header">
        <div>
          <h3>{farm.name}</h3>
          <span>{farm.owner || ''}</span>
        </div>
        <span className="badge badge-green">Akses Aktif</span>
      </div>
      <div className="farm-card-body">
        <div>
          <span>Lokasi Kebun</span>
          <strong>{farm.location || '—'}</strong>
        </div>
        <div>
          <span>Jenis Tanaman</span>
          <strong>{farm.crop_type || '—'}</strong>
        </div>
        <div>
          <span>Luas Lahan</span>
          <strong>{formatAreaHa(farm.area_ha)}</strong>
        </div>
      </div>
      <div className="farm-card-actions">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => onOpen && onOpen(farm)}
        >
          <i className="fas fa-arrow-right" aria-hidden="true" /> Buka Dashboard
        </button>
        {onDelete ? (
          <button
            className="btn btn-danger btn-sm"
            type="button"
            onClick={() => onDelete(farm)}
            aria-label={`Hapus kebun ${farm.name}`}
          >
            <i className="fas fa-trash" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}
