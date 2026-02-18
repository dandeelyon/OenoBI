import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface WineBatch {
  id: number;
  batchCode: string;
  batchNumber: string | null;
  description: string;
  productionYear: number;
  owner: {
    id: number;
    name: string;
    extId: string | null;
  };
  designatedVariety: {
    id: number;
    name: string;
  } | null;
  designatedRegion: {
    id: number;
    name: string;
  } | null;
  vessels: Array<{
    id: number;
    name: string;
    type: string;
    amount: {
      value: number;
      unit: string;
    };
  }>;
  allocations: any[];
  inactive: boolean;
  currentVolume: number;
  volumeUnit: string;
  totalCost?: {
    total: number;
    fruit: number;
    overhead: number;
    storage: number;
    additive: number;
    bulk: number;
    packaging: number;
    operation: number;
    freight: number;
    other: number;
  };
}

interface VintraceBatchContextType {
  batches2024: WineBatch[];
  batches2025: WineBatch[];
  allBatches: WineBatch[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const VintraceBatchContext = createContext<VintraceBatchContextType | undefined>(undefined);

export function VintraceBatchProvider({ children }: { children: ReactNode }) {
  const [allBatches, setAllBatches] = useState<WineBatch[]>([]);
  const [batches2024, setBatches2024] = useState<WineBatch[]>([]);
  const [batches2025, setBatches2025] = useState<WineBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-920a8867/vintrace/wine-batches?bbvOnly=true`;
      
      console.log('[Vintrace Batch Provider] Fetching wine batches...');

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${publicAnonKey}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log(`[Vintrace Batch Provider] Loaded ${data.batches.length} batches`);

      // Split batches by production year
      const batches24 = data.batches.filter((b: WineBatch) => b.productionYear === 2024);
      const batches25 = data.batches.filter((b: WineBatch) => b.productionYear === 2025);

      setAllBatches(data.batches);
      setBatches2024(batches24);
      setBatches2025(batches25);
    } catch (err) {
      console.error("[Vintrace Batch Provider] Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  return (
    <VintraceBatchContext.Provider
      value={{
        batches2024,
        batches2025,
        allBatches,
        loading,
        error,
        refetch: fetchBatches,
      }}
    >
      {children}
    </VintraceBatchContext.Provider>
  );
}

export function useVintraceBatches() {
  const context = useContext(VintraceBatchContext);
  if (context === undefined) {
    throw new Error('useVintraceBatches must be used within a VintraceBatchProvider');
  }
  return context;
}
