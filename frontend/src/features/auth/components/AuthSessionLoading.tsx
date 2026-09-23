import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AuthSessionLoading() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <p className="text-sm">{t('auth.sessionLoading')}</p>
    </div>
  );
}
