export type Role = 'ADMIN' | 'STAFF' | 'ENCODER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  created_at: string;
}

export type InventoryCategory = 'SEEDS' | 'FERTILIZER_ORGANIC' | 'FERTILIZER_INORGANIC' | 'DEWORMING' | 'ANTI_RABIES' | 'PESTICIDES';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  batch_number?: string;
  expiration_date?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: string;
  rsbsa_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  barangay: string;
  municipality: string;
  province: string;
  contact_number?: string;
  farm_area_hectares: number;
  commodity: string;
  created_at: string;
  updated_at: string;
}

export interface Distribution {
  id: string;
  recipient_id: string;
  inventory_id: string;
  quantity: number;
  date_distributed: string;
  distributed_by: string; // user id
  remarks?: string;
  created_at: string;
  
  // Joined fields for display
  recipient?: Recipient;
  inventory?: InventoryItem;
  distributor?: User;
}
