import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/auth-context';
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
  gatewayDeviceId: string;
  setGatewayDeviceId: (value: string) => void;
  gatewayDisplayName: string;
  setGatewayDisplayName: (value: string) => void;
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
  const [gatewayDeviceId, setGatewayDeviceId] = useState('');
  const [gatewayDisplayName, setGatewayDisplayName] = useState('');
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
    const trimmedGatewayDeviceId = gatewayDeviceId.trim();

    const missing: string[] = [];
    if (!trimmedGatewayDeviceId) missing.push(t('farms.addForm.fieldGateway'));
    if (!trimmedLocation) missing.push(t('farms.addForm.fieldLocation'));
    if (!trimmedCrop) missing.push(t('farms.addForm.fieldCrop'));
    if (!trimmedGatewayDeviceId) {
      setMissingFields(missing);
      return;
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
      await createFarm.mutateAsync({
        name: effectiveName,
        owner: owner.trim(),
        location: trimmedLocation,
        crop_type: trimmedCrop,
        // Area boleh kosong atau "-" untuk kebun kecil (mis. 5 pohon pisang): kirim null.
        area_ha: areaHa.trim() === '' || areaHa.trim() === '-' ? null : parseFloat(areaHa),
        // Kosong = backend meng-resolve sendiri dari koordinat + alamat saat kebun dibuat.
        bmkg_adm4_code: adm4.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        gateway_device_id: trimmedGatewayDeviceId,
        gateway_display_name: gatewayDisplayName.trim(),
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
    gatewayDeviceId,
    setGatewayDeviceId,
    gatewayDisplayName,
    setGatewayDisplayName,
    missingFields,
    feedback,
    busy,
    submitLabel,
    submit,
  };
}
