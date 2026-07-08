import { SelectFarmsView } from './components/SelectFarmsView';
import { useSelectFarmsViewModel } from './hooks/useSelectFarmsViewModel';

export default function SelectFarmsPage() {
  return <SelectFarmsView {...useSelectFarmsViewModel()} />;
}
