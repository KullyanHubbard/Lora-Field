import { ChangePasswordView } from '@/features/auth/components/ChangePasswordView';
import { useChangePasswordViewModel } from '@/features/auth/useChangePasswordViewModel';

export default function ChangePasswordPage() {
  const viewModel = useChangePasswordViewModel();

  return <ChangePasswordView viewModel={viewModel} />;
}
