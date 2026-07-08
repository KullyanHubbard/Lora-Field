import { LoginView } from '@/features/auth/components/LoginView';
import { useLoginViewModel } from '@/features/auth/useLoginViewModel';

export default function LoginPage() {
  const viewModel = useLoginViewModel();

  return <LoginView viewModel={viewModel} />;
}
