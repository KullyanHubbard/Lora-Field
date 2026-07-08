import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type MyFarmsSearchBarProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function MyFarmsSearchBar({ value, placeholder, onChange }: MyFarmsSearchBarProps) {
  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border-border bg-card pl-9"
      />
    </div>
  );
}
