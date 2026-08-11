export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  location: string;
  lastUpdated: string;
}

export type SortField = keyof InventoryItem;
export type SortOrder = 'asc' | 'desc';
