import { Download, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LOG_FILTER_OPTIONS, type LogFilterKey } from '@/features/logs/logHelpers';

export function LogsToolbarCard({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearDateFilter,
  onExportCsv,
  exportDisabled,
}: {
  activeFilter: LogFilterKey;
  onFilterChange: (filter: LogFilterKey) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onClearDateFilter: () => void;
  onExportCsv: () => void;
  exportDisabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter log">
              {LOG_FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  size="sm"
                  variant={activeFilter === opt.key ? 'default' : 'outline'}
                  aria-pressed={activeFilter === opt.key}
                  onClick={() => onFilterChange(opt.key)}
                >
                  {t(opt.label)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('logs.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-full pl-8"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onExportCsv}
              disabled={exportDisabled}
              className="w-full sm:w-auto"
            >
              <Download className="size-4" /> {t('logs.exportCsv')}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <span className="text-sm text-muted-foreground">{t('logs.dateFilterLabel')}:</span>
          <div className="grid gap-1.5 sm:flex sm:items-center">
            <label htmlFor="log-date-from" className="text-sm text-muted-foreground">
              {t('logs.dateFrom')}
            </label>
            <Input
              id="log-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="w-full text-sm sm:w-36"
              max={dateTo || undefined}
            />
          </div>
          <div className="grid gap-1.5 sm:flex sm:items-center">
            <label htmlFor="log-date-to" className="text-sm text-muted-foreground">
              {t('logs.dateTo')}
            </label>
            <Input
              id="log-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              className="w-full text-sm sm:w-36"
              min={dateFrom || undefined}
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearDateFilter}>
              ✕
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
