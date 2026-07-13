import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';
import { useCreateFarm, useFarms } from '@/features/dashboard/queries';

export interface AddFarmViewModel {
  name: string;
  setName: (value: string) => void;
  owner: string;
  setOwner: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  cropType: string;
  setCropType: (value: string) => void;
  areaHa: string;
  setAreaHa: (value: string) => void;
  lat: string;
  setLat: (value: string) => void;
  lng: string;
  setLng: (value: string) => void;
  adm4: string;
  setAdm4: (value: string) => void;
  missingFields: string[];
  feedback: string;
  busy: boolean;
  submitLabel: string;
  submit: () => Promise<void>;
}

/**
 * View model hook for the Add Farm page.
 * Manages form state, validation, and submission logic.
 */
export function useAddFarm(): AddFarmViewModel {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: farmsData } = useFarms();
  const createFarm = useCreateFarm();

  const [name, setName] = useState('');
  const [owner, setOwner] = useState(user?.name ?? '');
  const [location, setLocation] = useState('');
  const [cropType, setCropType] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [adm4, setAdm4] = useState('');
  const [forceSubmit, setForceSubmit] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const existingCount = farmsData?.items.length ?? 0;
  const busy = submitting || createFarm.isPending;

  const submit = async () => {
    if (busy) return;
    setFeedback('');

    const rawName = name.trim();
    const effectiveName = rawName || t('farms.addForm.defaultName', { count: existingCount + 1 });
    if (!rawName) setName(effectiveName);

    const trimmedLocation = location.trim();
    const trimmedCrop = cropType.trim();

    const missing: string[] = [];
    if (!trimmedLocation) missing.push(t('farms.addForm.fieldLocation'));
    if (!trimmedCrop) missing.push(t('farms.addForm.fieldCrop'));
    // Area boleh kosong atau "-" untuk kebun kecil (misal: 5 pohon pisang)
    if (areaHa === '' || areaHa.trim() === '-') {
      // Tidak wajib, lewati
    }
    if (missing.length && !forceSubmit) {
      setMissingFields(missing);
      setForceSubmit(true);
      return;
    }
    setMissingFields([]);

    const parsedLat = lat !== '' ? parseFloat(lat) : NaN;
    const parsedLng = lng !== '' ? parseFloat(lng) : NaN;
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setFeedback(t('farms.addForm.errorNoCoords'));
      return;
    }

    setSubmitting(true);
    try {
      // Best-effort resolve kode BMKG dari koordinat + alamat. Kalau belum ketemu,
      // kebun TETAP dibuat dengan kode kosong; backend meng-resolve otomatis nanti
      // (ensure_farm_bmkg_adm4) saat detail/cuaca kebun pertama dibuka.
      let resolvedAdm4 = adm4.trim();
      if (!resolvedAdm4) {
        try {
          const res = await api.resolveAdm4(parsedLat, parsedLng, trimmedLocation);
          resolvedAdm4 = res.found && res.adm4 ? res.adm4 : '';
        } catch {
          resolvedAdm4 = '';
        }
      }

      await createFarm.mutateAsync({
        name: effectiveName,
        owner: owner.trim(),
        location: trimmedLocation,
        crop_type: trimmedCrop,
        // Area null jika kosong atau "-" (kebun kecil)
        area_ha: areaHa.trim() === '' || areaHa.trim() === '-' ? null : parseFloat(areaHa),
        bmkg_adm4_code: resolvedAdm4,
        latitude: parsedLat,
        longitude: parsedLng,
      });
    } catch {
      // Kegagalan request sudah ditangani lewat toast di useCreateFarm.onError.
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel =
    forceSubmit && missingFields.length
      ? t('farms.addForm.submitForce')
      : t('farms.addForm.submit');

  return {
    name,
    setName,
    owner,
    setOwner,
    location,
    setLocation,
    cropType,
    setCropType,
    areaHa,
    setAreaHa,
    lat,
    setLat,
    lng,
    setLng,
    adm4,
    setAdm4,
    missingFields,
    feedback,
    busy,
    submitLabel,
    submit,
  };
}
