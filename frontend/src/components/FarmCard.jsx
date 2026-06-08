import { formatAreaHa } from '../utils/farmHelpers';

const STATUS_DOT = {
  active:      { cls: 'farm-status-dot--active',   title: 'Aktif' },
  inactive:    { cls: 'farm-status-dot--inactive',  title: 'Tidak Aktif' },
  offline:     { cls: 'farm-status-dot--inactive',  title: 'Tidak Aktif' },
  maintenance: { cls: 'farm-status-dot--warning',   title: 'Perlu Perhatian' },
};

function statusDot(status) {
  return STATUS_DOT[status] || { cls: 'farm-status-dot--warning', title: 'Perlu Perhatian' };
}

export function FarmCard({ farm, selected, onOpen, onDelete }) {
  const dot = statusDot(farm.status);

  return (
    <article
      className={`farm-card${selected ? ' is-selected' : ''}`}
      data-farm-card={farm.id}
    >
      <div className="farm-card-header">
        <div>
          <h3>{farm.name}</h3>
          <span>{farm.owner || ''}</span>
        </div>
        <span className={`farm-status-dot ${dot.cls}`} title={dot.title} aria-label={dot.title} />
      </div>
      <div className="farm-card-body">
        <div>
          <span>Lokasi Kebun</span>
          <strong>
            {farm.latitude != null && farm.longitude != null
              ? `${parseFloat(farm.latitude).toFixed(4)}, ${parseFloat(farm.longitude).toFixed(4)}`
              : '—'}
          </strong>
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
