export type Category = 
  | 'all' 
  | 'panels' 
  | 'inverters' 
  | 'batteries' 
  | 'mounting' 
  | 'protection' 
  | 'combiner' 
  | 'cables' 
  | 'mc4' 
  | 'sealings' 
  | 'clamps';

export interface Supplier {
  id: string | number;
  name: string;
  nameAr?: string;
  price: number;
  phone: string;
  location: string;
  verified: boolean;
  lastUpdate: string;
  email?: string;
  avatar?: string;
}

export interface Product {
  id: string | number;
  name: string;
  nameAr: string;
  brand: string;
  category: Category;
  power: number;
  area: number;
  efficiency: number;
  warranty: number;
  price: number;
  status: 'available' | 'limited' | 'out_of_stock';
  updatedAt: string;
  image: string;
  supplierId: string | number;
  datasheetUrl?: string;
  specs: Record<string, any>;
  suppliers: Supplier[];
}

export interface User {
  uid: string;
  email: string | null;
  name: string;
  nameAr?: string;
  type: 'customer' | 'supplier' | 'admin';
  company?: string;
  location?: string;
  phone?: string;
  avatar: string;
  verified: boolean;
  createdAt: string;
}

export type ViewType = 
  | 'home' 
  | 'compare' 
  | 'add' 
  | 'admin-suppliers' 
  | 'login' 
  | 'register' 
  | 'supplier-dashboard' 
  | 'profile'
  | 'wishlist'
  | 'detail'
  | 'calculator';

export interface Filters {
  category: Category;
  sort: 'power' | 'price' | 'efficiency';
}

export interface AdvancedFilters {
  minPower: string;
  maxPower: string;
  minPrice: string;
  maxPrice: string;
  minEfficiency: string;
  brand: string;
}
