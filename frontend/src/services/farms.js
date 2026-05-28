const SELECTED_KEY = 'lf_selected_farm';

export function getSelectedFarmId() {
  try {
    return localStorage.getItem(SELECTED_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function setSelectedFarmId(farmId) {
  try {
    if (farmId) localStorage.setItem(SELECTED_KEY, farmId);
    else localStorage.removeItem(SELECTED_KEY);
  } catch (_) {}
}

