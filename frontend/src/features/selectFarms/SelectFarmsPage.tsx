import { SelectFarmsView } from './components/SelectFarmsView';
import { useSelectFarmsViewModel } from './useSelectFarmsViewModel';

export default function SelectFarmsPage() {
  return <SelectFarmsView {...useSelectFarmsViewModel()} />;
}
