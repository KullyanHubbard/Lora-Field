import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRenameNode } from '@/features/irrigation/queries';
import type { Node } from '@/types';

interface NodeNameDialogProps {
  node: Node;
  onClose: () => void;
}

export function NodeNameDialog({ node, onClose }: NodeNameDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(node.name);
  const renameNode = useRenameNode();

  const trimmedName = name.trim();
  const canSave = trimmedName !== '' && trimmedName !== node.name && !renameNode.isPending;

  const handleSave = () => {
    if (!canSave) return;
    renameNode.mutate({ nodeId: node.id, name: trimmedName }, { onSuccess: onClose });
  };

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('irrigation.renameTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('irrigation.renameDesc', { id: node.id })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={renameNode.isPending}>
            {t('irrigation.renameCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canSave}
            onClick={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {renameNode.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('irrigation.renameSave')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
