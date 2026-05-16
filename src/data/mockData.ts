import { Product } from '../types';

export const productsData: Product[] = [
  { 
    id: 1, 
    name: "Jinko Solar JKM450M-72", 
    nameAr: "جينكو سولار JKM450M-72", 
    brand: "Jinko", 
    category: "panels", 
    power: 450, 
    area: 2.1, 
    efficiency: 21.5, 
    warranty: 25, 
    price: 12500, 
    status: "available", 
    updatedAt: "15-04-2026", 
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop", 
    supplierId: 1, 
    suppliers: [
      { id: 1, name: "SolarTech Egypt", nameAr: "سولارتك مصر", location: "القاهرة، مصر", phone: "201234567890", price: 12500, lastUpdate: "15-04-2026", verified: true }
    ], 
    specs: { type: "Monocrystalline", voltage: "37.2V", current: "12.1A", weight: "22.5kg" } 
  },
  { 
    id: 2, 
    name: "Trina Solar TSM-410", 
    nameAr: "ترينا سولار TSM-410", 
    brand: "Trina", 
    category: "panels", 
    power: 410, 
    area: 1.9, 
    efficiency: 21.0, 
    warranty: 25, 
    price: 11800, 
    status: "available", 
    updatedAt: "14-04-2026", 
    image: "https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?w=600&h=400&fit=crop", 
    supplierId: 1, 
    suppliers: [
      { id: 1, name: "SolarTech Egypt", nameAr: "سولارتك مصر", location: "القاهرة، مصر", phone: "201234567890", price: 11800, lastUpdate: "14-04-2026", verified: true }
    ], 
    specs: { type: "Monocrystalline", voltage: "34.8V", current: "11.8A", weight: "20.8kg" } 
  },
  { 
    id: 3, 
    name: "LONGi Hi-MO 5 540W", 
    nameAr: "لونجي Hi-MO 5 540W", 
    brand: "LONGi", 
    category: "panels", 
    power: 540, 
    area: 2.3, 
    efficiency: 22.1, 
    warranty: 25, 
    price: 15200, 
    status: "available", 
    updatedAt: "13-04-2026", 
    image: "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=600&h=400&fit=crop", 
    supplierId: 2, 
    suppliers: [
      { id: 2, name: "Future Solar", nameAr: "فيوتشر سولار", location: "الجيزة", phone: "201025510000", price: 15200, lastUpdate: "13-04-2026", verified: true }
    ], 
    specs: { type: "Monocrystalline", voltage: "40.1V", current: "13.55A", weight: "25.2kg" } 
  },
  { 
    id: 4, 
    name: "Growatt SPF 5000TL", 
    nameAr: "جرووات SPF 5000TL", 
    brand: "Growatt", 
    category: "inverters", 
    power: 5000, 
    area: 0.5, 
    efficiency: 97.5, 
    warranty: 10, 
    price: 18500, 
    status: "limited", 
    updatedAt: "12-04-2026", 
    image: "https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=600&h=400&fit=crop", 
    supplierId: 1, 
    suppliers: [
      { id: 3, name: "PowerTech Egypt", nameAr: "باور تك مصر", location: "القاهرة", phone: "201111111111", price: 18500, lastUpdate: "12-04-2026", verified: true }
    ], 
    specs: { type: "Hybrid", voltage: "48V", current: "100A", weight: "18kg" } 
  },
  { 
    id: 5, 
    name: "Pylontech US2000C", 
    nameAr: "بايلون تك US2000C", 
    brand: "Pylontech", 
    category: "batteries", 
    power: 2400, 
    area: 0.3, 
    efficiency: 95.0, 
    warranty: 10, 
    price: 22000, 
    status: "available", 
    updatedAt: "11-04-2026", 
    image: "https://images.unsplash.com/photo-1620626012053-10165ddf6f7a?w=600&h=400&fit=crop", 
    supplierId: 3, 
    suppliers: [
      { id: 4, name: "Battery Plus", nameAr: "باتري بلس", location: "القاهرة", phone: "201222222222", price: 22000, lastUpdate: "11-04-2026", verified: true }
    ], 
    specs: { type: "LiFePO4", voltage: "48V", current: "50A", weight: "24kg" } 
  },
  { 
    id: 6, 
    name: "JA Solar JAM60S20", 
    nameAr: "جا سولار JAM60S20", 
    brand: "JA Solar", 
    category: "panels", 
    power: 395, 
    area: 1.8, 
    efficiency: 20.8, 
    warranty: 25, 
    price: 10500, 
    status: "available", 
    updatedAt: "10-04-2026", 
    image: "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=600&h=400&fit=crop", 
    supplierId: 1, 
    suppliers: [
      { id: 1, name: "SolarTech Egypt", nameAr: "سولارتك مصر", location: "القاهرة، مصر", phone: "201234567890", price: 10500, lastUpdate: "10-04-2026", verified: true }
    ], 
    specs: { type: "Monocrystalline", voltage: "33.2V", current: "11.9A", weight: "19.5kg" } 
  }
];
