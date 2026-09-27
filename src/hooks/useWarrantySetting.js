/**
 * useWarrantySetting — the module-wide "Expiring Soon" warning window
 * (Inventory Settings → Warranty Settings). Shared by every warranty view so the
 * status shown is consistent across the Inventory module.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchWarrantySetting, DEFAULT_EXPIRING_SOON_DAYS } from '@/lib/warranty';

export function useWarrantySetting() {
  const { data = DEFAULT_EXPIRING_SOON_DAYS } = useQuery({
    queryKey: ['inventory-warranty-setting'],
    queryFn: fetchWarrantySetting,
    staleTime: 60000,
  });
  return data;
}