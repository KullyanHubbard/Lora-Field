import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, MapPin, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useCrops, useCreateFarm, useFarms } from './queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Crop } from '@/types';

function CropDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useCrops();
  const crops = data?.crops ?? [];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Crop | null>(null);

  const filter = value.toLowerCase();
  const filtered = filter ? crops.filter((c) => c.name.toLowerCase().includes(filter)) : crops;
  const visible = filtered.slice(0, 12);
  const showDropdown = open && visible.length > 0;

  return (
    <div className="relative">
      <Input
        id="farm-crop-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        placeholder="Cari atau ketik jenis tanaman..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {visible.map((crop) => (
            <li
              key={crop.name}
              role="option"
              aria-selected={picked?.name === crop.name}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(crop.name);
                setPicked(crop);
                setOpen(false);
              }}
            >
              {crop.name}
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Threshold VWC disarankan: {picked.lower_threshold}% – {picked.upper_threshold}%
        </p>
      )}
    </div>
  );
}

const GEO_ERRORS: Record<number, string> = {
  1: 'Izin lokasi ditolak. Klik ikon lokasi di browser lalu izinkan akses lokasi.',
  2: 'GPS tidak tersedia di perangkat ini.',
  3: 'Gagal mendeteksi lokasi. Pastikan GPS aktif dan coba lagi.',
};

function LocationDetector({
  lat,
  lng,
  onLatChange,
  onLngChange,
  onAdm4Change,
  locationHint,
}: {
  lat: string;
  lng: string;
  onLatChange: (v: string) => void;
  onLngChange: (v: string) => void;
  onAdm4Change: (v: string) => void;
  locationHint: string;
}) {
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'error' | 'warning' | '' }>({
    message: '',
    type: '',
  });
  const autoTriggered = useRef(false);

  const detect = useCallback(
    (mode: 'auto' | 'manual') => {
      if (!navigator.geolocation) {
        setStatus({ message: 'Browser tidak mendukung deteksi lokasi.', type: 'error' });
        return;
      }
      setDetecting(true);
      setStatus({
        message: mode === 'auto' ? 'Mendeteksi lokasi otomatis...' : 'Mendeteksi lokasi...',
        type: '',
      });
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const acc = Math.round(pos.coords.accuracy || 0);
          const dLat = Number(pos.coords.latitude.toFixed(6));
          const dLng = Number(pos.coords.longitude.toFixed(6));
          onLatChange(String(dLat));
          onLngChange(String(dLng));
          onAdm4Change('');
          const accText = acc ? `GPS (±${acc}m)` : 'GPS';
          try {
            const res = await api.resolveAdm4(dLat, dLng, locationHint);
            if (res.found && res.adm4) {
              onAdm4Change(res.adm4);
              setStatus({
                message: `Lokasi: ${dLat}, ${dLng} · ${accText} · Wilayah BMKG: ${res.adm4}`,
                type: '',
              });
            } else {
              onAdm4Change('');
              setStatus({
                message:
                  'Lokasi terdeteksi, tapi kode BMKG belum ditemukan. Isi alamat sampai desa/kecamatan/kabupaten lalu coba lagi.',
                type: 'warning',
              });
            }
          } catch {
            setStatus({
              message: 'Lokasi terdeteksi, tapi gagal menghubungkan ke resolver BMKG.',
              type: 'warning',
            });
          } finally {
            setDetecting(false);
          }
        },
        (err) => {
          setStatus({ message: GEO_ERRORS[err.code] || 'Gagal mendeteksi lokasi.', type: 'error' });
          setDetecting(false);
        },
        { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 },
      );
    },
    [locationHint, onLatChange, onLngChange, onAdm4Change],
  );

  // Auto-detect sekali saat mount kalau koordinat masih kosong (perilaku lama).
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    const h = window.setTimeout(() => {
      if (!lat && !lng) detect('auto');
    }, 350);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor =
    status.type === 'error'
      ? 'text-destructive'
      : status.type === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="farm-lat">Latitude</Label>
          <Input
            id="farm-lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            placeholder="Contoh: -7.8014"
            value={lat}
            onChange={(e) => {
              onLatChange(e.target.value);
              onAdm4Change('');
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="farm-lng">Longitude</Label>
          <Input
            id="farm-lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            placeholder="Contoh: 110.3647"
            value={lng}
            onChange={(e) => {
              onLngChange(e.target.value);
              onAdm4Change('');
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => detect('manual')} disabled={detecting}>
          <MapPin className="size-4" /> Deteksi Lokasi Sekarang
        </Button>
        {status.message && (
          <p className={cn('text-sm', statusColor)} aria-live="polite">
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AddFarmPage() {
  const { user } = useAuth();
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

  const existingCount = farmsData?.items.length ?? 0;

  const submit = async () => {
    setFeedback('');

    const rawName = name.trim();
    const effectiveName = rawName || `Kebun ${existingCount + 1}`;
    if (!rawName) setName(effectiveName);

    const trimmedLocation = location.trim();
    const trimmedCrop = cropType.trim();

    const missing: string[] = [];
    if (!trimmedLocation) missing.push('Lokasi');
    if (!trimmedCrop) missing.push('Jenis Tanaman');
    if (areaHa === '') missing.push('Luas Lahan');
    if (missing.length && !forceSubmit) {
      setMissingFields(missing);
      setForceSubmit(true);
      return;
    }
    setMissingFields([]);

    const parsedLat = lat !== '' ? parseFloat(lat) : NaN;
    const parsedLng = lng !== '' ? parseFloat(lng) : NaN;
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setFeedback(
        'Lokasi kebun belum terdeteksi. Izinkan akses lokasi browser atau isi koordinat kebun.',
      );
      return;
    }

    let resolvedAdm4 = adm4.trim();
    if (!resolvedAdm4) {
      try {
        const res = await api.resolveAdm4(parsedLat, parsedLng, trimmedLocation);
        resolvedAdm4 = res.found && res.adm4 ? res.adm4 : '';
      } catch {
        resolvedAdm4 = '';
      }
    }
    if (!resolvedAdm4) {
      setFeedback(
        'Kode BMKG belum otomatis terdeteksi. Isi lokasi sampai nama desa, kecamatan, dan kabupaten, lalu klik Deteksi Lokasi Sekarang.',
      );
      return;
    }

    createFarm.mutate({
      name: effectiveName,
      owner: owner.trim(),
      location: trimmedLocation,
      crop_type: trimmedCrop,
      area_ha: areaHa !== '' ? parseFloat(areaHa) : null,
      bmkg_adm4_code: resolvedAdm4,
      latitude: parsedLat,
      longitude: parsedLng,
    });
  };

  const submitLabel = forceSubmit && missingFields.length ? 'Tetap Simpan' : 'Tambah Kebun';

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Button asChild variant="ghost" size="icon" className="size-7">
            <Link to="/dashboard" aria-label="Kembali">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          Tambah Kebun
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
          className="space-y-5"
        >
          <p className="text-sm font-medium text-muted-foreground">Profil Kebun</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="farm-name">Nama Kebun</Label>
              <Input
                id="farm-name"
                maxLength={100}
                placeholder="Biarkan kosong untuk nama otomatis"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm-owner">Pemilik Kebun</Label>
              <Input
                id="farm-owner"
                maxLength={100}
                placeholder="Nama pemilik"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="farm-location">Lokasi / Alamat</Label>
              <Input
                id="farm-location"
                maxLength={200}
                placeholder="Contoh: Jl. Parangtritis, Bantul"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (adm4) setAdm4('');
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm-crop-input">Jenis Tanaman</Label>
              <CropDropdown value={cropType} onChange={setCropType} />
            </div>
          </div>

          <div className="space-y-1.5 sm:max-w-[50%]">
            <Label htmlFor="farm-area">Luas Lahan (ha)</Label>
            <Input
              id="farm-area"
              type="number"
              min={0}
              step="0.01"
              placeholder="Contoh: 1.5"
              value={areaHa}
              onChange={(e) => setAreaHa(e.target.value)}
            />
          </div>

          <p className="pt-1 text-sm font-medium text-muted-foreground">Koordinat Kebun</p>

          <LocationDetector
            lat={lat}
            lng={lng}
            onLatChange={setLat}
            onLngChange={setLng}
            onAdm4Change={setAdm4}
            locationHint={location}
          />

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" /> Koordinat digunakan untuk menampilkan kebun di peta.
            Kosongkan jika belum tersedia.
          </p>

          {missingFields.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/50 p-3 text-sm text-amber-600 dark:text-amber-400">
              <Info className="mt-0.5 size-4 shrink-0" />
              <div>
                <strong>Data kebun belum lengkap.</strong> {missingFields.join(', ')} belum diisi.
                Lengkapi data ini untuk hasil monitoring yang optimal.
              </div>
            </div>
          )}

          {feedback && (
            <p className="text-sm text-destructive" role="status" aria-live="polite">
              {feedback}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={createFarm.isPending}>
              <Plus className="size-4" /> {submitLabel}
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Batal</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
