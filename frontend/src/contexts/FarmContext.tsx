import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface FarmContextValue {
  selectedFarmId: string | null;
  selectFarm: (farmId: string) => void;
  clearFarm: () => void;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  const selectFarm = useCallback((farmId: string) => {
    setSelectedFarmId(farmId);
  }, []);

  const clearFarm = useCallback(() => {
    setSelectedFarmId(null);
  }, []);

  return (
    <FarmContext.Provider value={{ selectedFarmId, selectFarm, clearFarm }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useSelectedFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useSelectedFarm harus dipakai di dalam <FarmProvider>');
  return ctx;
}
