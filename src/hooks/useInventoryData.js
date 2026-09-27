/**
 * useInventoryData — shared React Query hook that loads all inventory items,
 * transactions, and lookups for the Inventory Management module.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchItems, fetchTransactions, fetchAllLookups, fetchWarrantyRecords } from '@/lib/inventoryService';

export function useInventoryData(filters = {}) {
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => fetchItems(true),
    staleTime: 30000,
  });

  const { data: transactions = [], isLoading: txnsLoading } = useQuery({
    queryKey: ['inventory-transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 15000,
  });

  // Warranty records live under the transactions query key on purpose, so every
  // existing refresh (which invalidates ['inventory-transactions']) also reloads
  // warranties and no page has to change.
  const { data: warranties = [] } = useQuery({
    queryKey: ['inventory-transactions', 'warranties'],
    queryFn: fetchWarrantyRecords,
    staleTime: 30000,
  });

  const { data: lookups = [] } = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: fetchAllLookups,
    staleTime: 60000,
  });

  const getLookupOptions = (type) =>
    lookups.filter(l => l.type === type && !l.is_deleted && l.is_active !== false);

  return {
    items,
    transactions,
    warranties,
    lookups,
    getLookupOptions,
    isLoading: itemsLoading || txnsLoading,
  };
}