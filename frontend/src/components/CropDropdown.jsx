import { useEffect, useState } from 'react';
import { listCrops } from '../services/api';

const MAX_OPTIONS = 12;

/**
 * Dropdown jenis tanaman dengan filter search. Menampilkan hint VWC
 * threshold kalau crop yang dipilih ada di tabel referensi backend.
 *
 * Props:
 *   value             — string crop name (controlled)
 *   onChange(name)    — dipanggil saat user ketik atau pilih dari list
 *   id, placeholder   — optional, di-pass ke input
 */
export function CropDropdown({ value, onChange, id = 'farm-crop-input', placeholder }) {
  const [crops, setCrops] = useState([]);
  const [open, setOpen] = useState(false);
  // Crop yang aktif dipilih dari dropdown (bukan ketikan bebas) → tampil hint.
  // Reset ke null kalau user mengetik manual.
  const [pickedCrop, setPickedCrop] = useState(null);

  // Load crop list sekali saat mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await listCrops();
      if (cancelled) return;
      if (ok && Array.isArray(data.crops)) {
        setCrops(data.crops);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filter = (value || '').toLowerCase();
  const filtered = filter ? crops.filter((c) => c.name.toLowerCase().includes(filter)) : crops;
  const visible = filtered.slice(0, MAX_OPTIONS);

  function handleInputChange(event) {
    onChange(event.target.value);
    setPickedCrop(null);
    setOpen(true);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleBlur() {
    // Delay close supaya mousedown di option masih ke-trigger.
    window.setTimeout(() => setOpen(false), 160);
  }

  function handleSelect(crop) {
    onChange(crop.name);
    setPickedCrop(crop);
    setOpen(false);
  }

  const showDropdown = open && visible.length > 0;
  const hasThreshold =
    pickedCrop && pickedCrop.lower_threshold != null && pickedCrop.upper_threshold != null;

  return (
    <>
      <div className="crop-select-wrap">
        <input
          className="form-control"
          type="text"
          id={id}
          autoComplete="off"
          maxLength={100}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="crop-dropdown"
          aria-haspopup="listbox"
          placeholder={placeholder || 'Cari atau ketik jenis tanaman...'}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <ul
          className="crop-dropdown"
          id="crop-dropdown"
          role="listbox"
          hidden={!showDropdown}
        >
          {visible.map((crop) => (
            <li
              key={crop.name}
              className="crop-option"
              role="option"
              aria-selected={pickedCrop?.name === crop.name}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(crop);
              }}
            >
              {crop.name}
            </li>
          ))}
        </ul>
      </div>
      {hasThreshold ? (
        <p className="crop-threshold-hint">
          Threshold VWC disarankan: {pickedCrop.lower_threshold}% – {pickedCrop.upper_threshold}%
        </p>
      ) : null}
    </>
  );
}
