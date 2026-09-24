import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, LogOut, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/auth-context';
import { useUpdateLanguage, useUpdateProfile } from '@/features/auth/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPreferredLanguage, isAppLanguage } from '@/i18n/language';
import { EMPTY_VALUE } from '@/lib/format';

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const updateProfile = useUpdateProfile();
  const updateLanguage = useUpdateLanguage();

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  const startEdit = () => {
    setPhoneInput(user?.phone ?? '');
    setEditingPhone(true);
  };

  const savePhone = () => {
    updateProfile.mutate(phoneInput.trim(), {
      onSuccess: () => setEditingPhone(false),
    });
  };

  const handleLanguageChange = (lang: string) => {
    if (isAppLanguage(lang)) updateLanguage.mutate(lang);
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t('settingsPage.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <ProfileField label={t('settingsPage.fieldName')} value={user?.name || t('settingsPage.notAvailable')} />
          <ProfileField label={t('settingsPage.fieldEmail')} value={user?.email || t('settingsPage.notAvailable')} />
          <div className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm last:border-b-0">
            <span className="text-muted-foreground">{t('settingsPage.fieldPhone')}</span>
            {editingPhone ? (
              <div className="flex items-center gap-2">
                <Input
                  type="tel"
                  autoComplete="tel"
                  maxLength={20}
                  placeholder="Contoh: 08123456789"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="h-8 w-44"
                  autoFocus
                />
                <Button size="sm" onClick={savePhone} disabled={updateProfile.isPending}>
                  {t('settingsPage.save')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingPhone(false)}
                  disabled={updateProfile.isPending}
                >
                  {t('settingsPage.cancel')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{user?.phone || EMPTY_VALUE}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={startEdit}
                  aria-label={t('settingsPage.editPhone')}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="text-muted-foreground">{t('common.language')}</span>
            <Select
              value={user?.language ?? getPreferredLanguage()}
              onValueChange={handleLanguageChange}
              disabled={updateLanguage.isPending}
            >
              <SelectTrigger className="h-8 w-44" aria-busy={updateLanguage.isPending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">{t('common.languageId')}</SelectItem>
                <SelectItem value="en">{t('common.languageEn')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/change-password">
              <KeyRound className="size-4" /> {t('settingsPage.changePassword')}
            </Link>
          </Button>
          <Button variant="destructive" onClick={logout}>
            <LogOut className="size-4" /> {t('settingsPage.logout')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
