import { useTranslation } from 'react-i18next';
import { LIMITED_IRRIGATION_MAX_DAYS } from '@/features/irrigation/limitedIrrigation';

// Penjelasan Irigasi Terbatas. Versi singkat di tanda tanya halaman Irigasi, versi lengkap
// (withDetails) di Pusat Bantuan.
export function LimitedIrrigationHelp({ withDetails = false }: { withDetails?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 text-sm">
      {(['what', 'when', 'notFor'] as const).map((part) => (
        <div key={part}>
          <p className="font-medium text-foreground">{t(`limitedIrrigation.help.${part}Title`)}</p>
          <p className="text-muted-foreground">{t(`limitedIrrigation.help.${part}`)}</p>
        </div>
      ))}
      {withDetails && (
        <div>
          <p className="font-medium text-foreground">{t('limitedIrrigation.help.detailsTitle')}</p>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {(['scope', 'manual', 'date', 'history', 'rice'] as const).map((detail) => (
              <li key={detail}>
                {t(`limitedIrrigation.help.details.${detail}`, {
                  days: LIMITED_IRRIGATION_MAX_DAYS,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
