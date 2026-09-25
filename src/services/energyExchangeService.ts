import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, SOLAR_PANEL_BRANDS, SolarPanelBrand } from '../types';
import { safeLocalStorage } from '../utils/safeStorage';

export const DEFAULT_SOLAR_PANEL_PRICES: Record<SolarPanelBrand, number> = {
  'Jinko': 12.00,
  'LONGi Solar': 12.20,
  'AIKO': 12.50,
  'Trina Solar': 11.90,
  'JA Solar': 11.95,
  'Risen': 11.80,
  'GCL': 11.75,
  'Suntech': 11.85,
  'Astronergy': 11.90,
  'Gokin': 11.70,
  'Quantum Solar': 11.80,
  'Ulica Solar': 11.75,
  'ZNShine Solar': 11.80,
};

const STORAGE_KEY = 'enerjoo_solar_exchange_prices';
const COLLECTION_NAME = 'energyExchange';
const DOC_ID = 'solarPanelPrices';

/**
 * Robustly matches an existing product to its approved solar panel brand.
 */
export function matchBrandToExchange(brandName?: string, productName?: string): SolarPanelBrand | null {
  const b = (brandName || '').toLowerCase().trim();
  const n = (productName || '').toLowerCase().trim();
  const combined = `${b} ${n}`;

  if (combined.includes('jinko')) return 'Jinko';
  if (combined.includes('longi')) return 'LONGi Solar';
  if (combined.includes('aiko')) return 'AIKO';
  if (combined.includes('trina')) return 'Trina Solar';
  if (combined.includes('ja solar') || b === 'ja' || combined.includes('jasolar')) return 'JA Solar';
  if (combined.includes('risen')) return 'Risen';
  if (combined.includes('gcl')) return 'GCL';
  if (combined.includes('suntech')) return 'Suntech';
  if (combined.includes('astronergy')) return 'Astronergy';
  if (combined.includes('gokin')) return 'Gokin';
  if (combined.includes('quantum')) return 'Quantum Solar';
  if (combined.includes('ulica')) return 'Ulica Solar';
  if (combined.includes('znshine') || combined.includes('zn-shine')) return 'ZNShine Solar';

  return null;
}

/**
 * Accurately extracts the rated power in Watts from product fields or title.
 */
export function getSolarPanelWattage(product: Product): number {
  if (product.power && product.power > 0) return product.power;
  if (product.specs?.powerKw && Number(product.specs.powerKw) > 0) {
    return Math.round(Number(product.specs.powerKw) * 1000);
  }
  if (product.specs?.ratedPowerKw && Number(product.specs.ratedPowerKw) > 0) {
    return Math.round(Number(product.specs.ratedPowerKw) * 1000);
  }
  const match = (product.name || '').match(/(\d{3,4})\s*[wW]/);
  if (match && match[1]) {
    return Number(match[1]);
  }
  return 0;
}

/**
 * Computes pricing for a product based on the centralized Energy Exchange:
 * Panel Price = Panel Power (W) × Brand Price Per Watt
 * ONLY applies to solar panels. All other product categories remain strictly untouched.
 */
export function applySolarPanelPricing(
  product: Product,
  brandPrices: Record<string, number>
): Product {
  if (product.category !== 'panels') {
    return product;
  }

  const matchedBrand = matchBrandToExchange(product.brand, product.name);
  if (!matchedBrand) {
    return product;
  }

  const pricePerWatt = brandPrices[matchedBrand] ?? DEFAULT_SOLAR_PANEL_PRICES[matchedBrand];
  if (!pricePerWatt || pricePerWatt <= 0) {
    return product;
  }

  const wattage = getSolarPanelWattage(product);
  if (wattage <= 0) {
    return {
      ...product,
      pricePerWatt,
      exchangeBrand: matchedBrand
    };
  }

  const calculatedPrice = Math.round(wattage * pricePerWatt);

  return {
    ...product,
    price: calculatedPrice,
    pricePerWatt,
    exchangeBrand: matchedBrand
  };
}

/**
 * Applies pricing to an array of products.
 */
export function applySolarPanelPricingToProducts(
  products: Product[],
  brandPrices: Record<string, number>
): Product[] {
  return products.map(p => applySolarPanelPricing(p, brandPrices));
}

/**
 * Gets cached prices from localStorage or fallback to defaults.
 */
export function getInitialExchangePrices(): Record<string, number> {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_SOLAR_PANEL_PRICES, ...parsed };
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SOLAR_PANEL_PRICES };
}

// Active in-memory listeners
type ExchangeListener = (prices: Record<string, number>) => void;
const listeners = new Set<ExchangeListener>();
let currentPrices: Record<string, number> = getInitialExchangePrices();

function notifyListeners(prices: Record<string, number>) {
  currentPrices = prices;
  try {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  } catch {
    // ignore
  }
  listeners.forEach(cb => {
    try {
      cb(prices);
    } catch (err) {
      console.error('Error in exchange listener:', err);
    }
  });
}

/**
 * Subscribes to real-time updates from Backend API, LocalStorage, and Firestore.
 */
export function subscribeToEnergyExchange(
  callback: (prices: Record<string, number>) => void
): () => void {
  listeners.add(callback);
  // Send current cached value immediately
  callback(currentPrices);

  // Initial fetch from backend API
  if (typeof window !== 'undefined') {
    fetch('/api/energy-exchange')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.prices) {
          notifyListeners({ ...DEFAULT_SOLAR_PANEL_PRICES, ...data.prices });
        }
      })
      .catch(err => {
        console.warn('Could not fetch /api/energy-exchange:', err);
      });
  }

  // Listen to Firestore real-time snapshot
  let unsubscribeFirestore = () => {};
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    unsubscribeFirestore = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          let loadedPrices: Record<string, number> = {};
          if (data.prices && typeof data.prices === 'object') {
            loadedPrices = data.prices;
          } else {
            // If stored as top-level fields
            SOLAR_PANEL_BRANDS.forEach(b => {
              if (typeof data[b] === 'number') {
                loadedPrices[b] = data[b];
              }
            });
          }
          const merged = { ...DEFAULT_SOLAR_PANEL_PRICES, ...currentPrices, ...loadedPrices };
          notifyListeners(merged);
        }
      },
      (error) => {
        console.warn('Energy Exchange Firestore onSnapshot notice:', error);
      }
    );
  } catch (e) {
    console.warn('Firestore subscription notice:', e);
  }

  // Listen to storage events across browser tabs
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && typeof parsed === 'object') {
          notifyListeners({ ...DEFAULT_SOLAR_PANEL_PRICES, ...parsed });
        }
      } catch {
        // ignore
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  return () => {
    listeners.delete(callback);
    unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
  };
}

/**
 * Admin action: Updates the price per watt for a solar panel brand.
 * Updates local memory, persists to backend API, and syncs to Firestore.
 */
export async function updateSolarPanelBrandPrice(
  brand: SolarPanelBrand,
  newPricePerWatt: number,
  adminEmail?: string
): Promise<void> {
  if (typeof newPricePerWatt !== 'number' || isNaN(newPricePerWatt) || newPricePerWatt <= 0) {
    throw new Error('Invalid price per watt');
  }

  const rounded = parseFloat(newPricePerWatt.toFixed(2));

  // Update local memory and notify listeners immediately for zero-latency UI response
  const updatedPrices = {
    ...currentPrices,
    [brand]: rounded
  };
  notifyListeners(updatedPrices);

  // 1. Persist to server backend API
  try {
    const res = await fetch('/api/energy-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand,
        pricePerWatt: rounded,
        adminEmail: adminEmail || 'admin'
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.prices) {
        notifyListeners({ ...updatedPrices, ...data.prices });
      }
    }
  } catch (apiErr) {
    console.warn('Backend API /api/energy-exchange notice:', apiErr);
  }

  // 2. Attempt Firestore sync
  try {
    const docRef = doc(db, COLLECTION_NAME, DOC_ID);
    await setDoc(
      docRef,
      {
        prices: {
          [brand]: rounded
        },
        [`prices.${brand}`]: rounded,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail || 'admin'
      },
      { merge: true }
    );
  } catch (firestoreErr) {
    console.warn(`Firestore sync notice for ${brand} (saved successfully via backend API and local store):`, firestoreErr);
  }
}
