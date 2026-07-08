import { RegisterView } from '@/features/auth/components/RegisterView';
import { useRegisterViewModel } from '@/features/auth/useRegisterViewModel';

export default function RegisterPage() {
  const viewModel = useRegisterViewModel();

  return <RegisterView viewModel={viewModel} />;
}
