import { MyFarmsView } from './components/MyFarmsView';
import { useMyFarmsViewModel } from './useMyFarmsViewModel';

export default function MyFarmsPage() {
  return <MyFarmsView {...useMyFarmsViewModel()} />;
}
