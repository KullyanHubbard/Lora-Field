import { ResetPasswordView } from '@/features/auth/components/ResetPasswordView';
import { useResetPasswordViewModel } from '@/features/auth/useResetPasswordViewModel';

export default function ResetPasswordPage() {
  const viewModel = useResetPasswordViewModel();

  return <ResetPasswordView viewModel={viewModel} />;
}
