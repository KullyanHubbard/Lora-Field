import { useTranslation } from 'react-i18next';
import { Mail, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { contactInfo } from '@/features/helpCenter/constants';

interface HelpCenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpCenterDialog({ isOpen, onClose }: HelpCenterDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 size-8"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>

        <h2 className="mb-6 text-xl font-bold tracking-tight">{t('helpCenter.contact.title')}</h2>

        <div className="grid gap-4">
          {/* Email */}
          <Card>
            <CardContent className="flex items-start gap-3.5 p-4">
              <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">{t('helpCenter.contact.email')}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground break-all">
                  {contactInfo.email}
                </p>
              </div>
            </CardContent>
          </Card>

          {contactInfo.whatsapp && (
            <Card>
              <CardContent className="flex items-start gap-3.5 p-4">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground">
                    {t('helpCenter.contact.whatsapp')}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{contactInfo.whatsapp}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {contactInfo.whatsapp && (
          <div className="mt-4 flex justify-center">
            <Button asChild>
              <a
                href={`https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <MessageCircle className="mr-2 size-4" />
                {t('helpCenter.contact.chatButton')}
              </a>
            </Button>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
