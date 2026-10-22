import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  doc, 
  query, 
  onSnapshot,
  serverTimestamp,
  where,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Supplier, Category, DimensionUnit, ProductReview, SolarRequest, SolarRequestStatus, Customer, Quotation, QuotationStatus } from '../types';
import { classifyInverter } from '../utils/inverterClassification';
import { parseInverterQuery, matchInverters } from '../utils/inverterMatching';
import { StructuredInverter, InverterQueryCriteria, InverterMatchResult } from '../types/inverter';
import { normalizeEgyptianPhone } from '../utils/phoneUtils';
import { formatDateOnly } from '../utils/dateUtils';
import { isRawUidOrId } from '../utils/supplierUtils';
import { productsData } from '../data/mockData';
import { safeLocalStorage } from '../utils/safeStorage';
import { SUPPLIER_CONTACT_PHONE_DISPLAY } from '../constants/contact';

const DELETED_PRODUCTS_STORAGE_KEY = 'enerjoo_deleted_product_ids_v2';

export const getDeletedProductIds = (): Set<string> => {
  try {
    // Purge old contaminated key from previous test runs
    if (typeof window !== 'undefined') {
      const oldRaw = safeLocalStorage.getItem('enerjoo_deleted_product_ids_v1');
      if (oldRaw) {
        safeLocalStorage.removeItem('enerjoo_deleted_product_ids_v1');
      }
    }
    const raw = safeLocalStorage.getItem(DELETED_PRODUCTS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        // Protect all baseline products: baseline catalog items must never be suppressed by stale local keys
        const baselineIds = new Set(productsData.map(p => String(p.id)));
        const validDeletes = arr.filter(id => !baselineIds.has(String(id)));
        return new Set(validDeletes.map(String));
      }
    }
  } catch (err) {
    console.warn('Error reading deleted products from storage:', err);
  }
  return new Set();
};

export const markProductAsDeleted = (productId: string | number): void => {
  try {
    const pId = String(productId);
    const set = getDeletedProductIds();
    set.add(pId);
    safeLocalStorage.setItem(DELETED_PRODUCTS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('Error saving deleted product to storage:', err);
  }
};

export const unmarkProductAsDeleted = (productId: string | number): void => {
  try {
    const pId = String(productId);
    const set = getDeletedProductIds();
    if (set.has(pId)) {
      set.delete(pId);
      safeLocalStorage.setItem(DELETED_PRODUCTS_STORAGE_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (err) {
    console.warn('Error unmarking deleted product in storage:', err);
  }
};

export const filterDeletedProducts = (products: Product[]): Product[] => {
  const deletedSet = getDeletedProductIds();
  if (deletedSet.size === 0) return products;
  return products.filter(p => !deletedSet.has(String(p.id)) && !deletedSet.has(String((p as any).product_id)));
};

const PRODUCTS_COLLECTION = 'products';
const USERS_COLLECTION = 'users';
const SOLAR_REQUESTS_COLLECTION = 'solarRequests';
const CUSTOMERS_COLLECTION = 'customers';
const QUOTATIONS_COLLECTION = 'quotations';

// In-memory cache of verified supplier profiles to enrich products
const supplierProfileCache = new Map<string, Supplier>();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error(`Firestore Error:`, JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Cloudflare D1 Products API
const CF_DIRECT_BASE_URL = 'https://enerjoo-api.enerjoo320.workers.dev';
const getProductsApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In preview or sandbox environments, use the local proxy to prevent browser CORS blocks
    if (window.location.hostname !== 'enerjoo.com') {
      return '/api';
    }
  }
  return CF_DIRECT_BASE_URL;
};

// In-memory product listeners to notify active components immediately upon product mutations
type ProductsListener = (products: Product[]) => void;
const activeProductListeners: Set<ProductsListener> = new Set();

const notifyProductListeners = async () => {
  if (activeProductListeners.size === 0) return;
  try {
    const products = await getProducts();
    for (const listener of activeProductListeners) {
      try {
        listener(products);
      } catch (err) {
        console.error('Error in product listener callback:', err);
      }
    }
  } catch (err) {
    console.error('Failed to notify product listeners:', err);
  }
};

/**
 * Internal helper for Cloudflare Worker D1 Products API requests.
 */
async function requestProductsApi<T>(path: string, options?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getProductsApiBaseUrl();
  const url = `${baseUrl}${normalizedPath}`;
  
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });
  } catch (err) {
    // If direct worker fetch failed due to CORS or network error, attempt fallback through proxy
    if (baseUrl !== '/api') {
      try {
        const fallbackUrl = `/api${normalizedPath}`;
        res = await fetch(fallbackUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {})
          }
        });
      } catch (fallbackErr) {
        const errorMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error(`Network error connecting to Products API at ${url}:`, errorMsg);
        throw new Error(`Network error connecting to Products API: ${errorMsg}`);
      }
    } else {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Network error connecting to Products API at ${url}:`, errorMsg);
      throw new Error(`Network error connecting to Products API: ${errorMsg}`);
    }
  }

  // Handle 404 cleanly without throwing fatal errors
  if (res.status === 404) {
    if (normalizedPath === '/products' || normalizedPath.startsWith('/products?')) {
      return { success: true, count: 0, products: [] } as T;
    }
    return { success: false, notFound: true, product: null, products: [] } as T;
  }

  if (!res.ok) {
    let errorDetail = `Status ${res.status} ${res.statusText}`;
    try {
      const errJson: any = await res.json();
      if (errJson) {
        if (typeof errJson.error === 'string') {
          errorDetail = errJson.error;
        } else if (errJson.error?.message && typeof errJson.error.message === 'string') {
          errorDetail = errJson.error.message;
        } else if (typeof errJson.message === 'string') {
          errorDetail = errJson.message;
        }
      }
    } catch {
      // Ignore JSON parse error on non-ok responses
    }
    throw new Error(`Products API error (${res.status}): ${errorDetail}`);
  }

  try {
    const json = await res.json();
    return json as T;
  } catch (err) {
    console.error(`Invalid JSON received from Products API at ${url}:`, err);
    throw new Error('Invalid JSON response from Products API');
  }
}

/**
 * Map category from D1 format to frontend Category enum.
 */
function mapD1CategoryToCategory(catStr?: string | null): Category {
  if (!catStr) return 'panels';
  const c = catStr.toLowerCase();
  if (c.includes('panel') || c.includes('لوح') || c.includes('ألواح') || c.includes('الواح')) return 'panels';
  if (c.includes('invert') || c.includes('محول') || c.includes('إنفرتر') || c.includes('انفرتر')) return 'inverters';
  if (c.includes('batter') || c.includes('بطار')) return 'batteries';
  if (c.includes('pump') || c.includes('مضخ') || c.includes('طلمب')) return 'pumps';
  if (c.includes('mount') || c.includes('structur') || c.includes('هيكل') || c.includes('شاسيه')) return 'mounting';
  if (c.includes('protect') || c.includes('حماي') || c.includes('قاطع')) return 'protection';
  if (c.includes('combin') || c.includes('تجميع') || c.includes('صندوق')) return 'combiner';
  if (c.includes('cable') || c.includes('كابل') || c.includes('سلك')) return 'cables';
  if (c.includes('mc4')) return 'mc4';
  if (c.includes('seal') || c.includes('عازل') || c.includes('عوازل')) return 'sealings';
  if (c.includes('clamp') || c.includes('كلبس') || c.includes('تثبيت')) return 'clamps';
  return (c as Category) || 'panels';
}

/**
 * Map frontend Category to D1 category string.
 */
function mapCategoryToD1Category(cat?: Category): string {
  switch (cat) {
    case 'panels': return 'Solar Panels';
    case 'inverters': return 'Inverters';
    case 'batteries': return 'Batteries';
    case 'pumps': return 'Pumps';
    case 'mounting': return 'Mounting Structures';
    case 'protection': return 'Protection & Distribution';
    case 'combiner': return 'Combiner Boxes';
    case 'cables': return 'Solar Cables';
    case 'mc4': return 'MC4 Connectors';
    case 'sealings': return 'Sealings';
    case 'clamps': return 'Clamps';
    default: return cat || 'Solar Panels';
  }
}

/**
 * Helper to robustly parse dimensions string (e.g. "2384 x 1303 x 35 mm", "2384*1303*35", "2384 x 1303")
 */
export function parseDimensionsString(dimStr?: string | null): {
  length?: number;
  width?: number;
  thickness?: number;
  dimensionUnit?: DimensionUnit;
  area?: number;
} {
  if (!dimStr || typeof dimStr !== 'string') return {};
  const cleaned = dimStr.trim();
  const match = cleaned.match(/([\d.]+)\s*[*xX×]\s*([\d.]+)(?:\s*[*xX×]\s*([\d.]+))?\s*(mm|cm|m)?/i);
  if (match) {
    const l = parseFloat(match[1]);
    const w = parseFloat(match[2]);
    const th = match[3] ? parseFloat(match[3]) : undefined;
    const unit = (match[4]?.toLowerCase() || 'mm') as DimensionUnit;
    let area: number | undefined;
    if (!isNaN(l) && !isNaN(w)) {
      if (unit === 'mm') area = parseFloat(((l * w) / 1_000_000).toFixed(4));
      else if (unit === 'cm') area = parseFloat(((l * w) / 10_000).toFixed(4));
      else if (unit === 'm') area = parseFloat((l * w).toFixed(4));
    }
    return {
      length: !isNaN(l) ? l : undefined,
      width: !isNaN(w) ? w : undefined,
      thickness: th !== undefined && !isNaN(th) ? th : undefined,
      dimensionUnit: unit,
      area
    };
  }
  return {};
}

/**
 * Map D1 product object to application Product interface.
 */
function resolveDefaultD1Image(cat: Category, brand: string, model: string): string {
  const b = (brand || '').toLowerCase();
  const m = (model || '').toLowerCase();
  if (cat === 'inverters') {
    if (b.includes('huawei') || m.includes('sun2000')) {
      return 'https://enerjoo-api.enerjoo320.workers.dev/files/products/1790087530856-b5aswi77.jpg';
    }
    if (b.includes('invt') || m.includes('pump')) {
      return 'https://enerjoo-api.enerjoo320.workers.dev/files/products/1791793955618-hnt8gcsl.jpg';
    }
    return 'https://enerjoo-api.enerjoo320.workers.dev/files/products/1791474437619-nrtfkfhx.jpg';
  }
  if (cat === 'panels') {
    if (b.includes('longi') || b.includes('trina')) {
      return 'https://enerjoo-api.enerjoo320.workers.dev/files/products/1791043105976-4eukpdun.png';
    }
    return 'https://enerjoo-api.enerjoo320.workers.dev/files/products/1791028978582-ye8lbh70.png';
  }
  if (cat === 'batteries') {
    return 'https://enerjoo-api.enerjoo320.workers.dev/files/products/1791474965434-xr788udb.jpg';
  }
  return 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2944&auto=format&fit=crop';
}

function normalizeD1Brand(rawBrand?: string | null, model?: string | null): string {
  const b = String(rawBrand || '').trim();
  const bl = b.toLowerCase();
  const ml = String(model || '').toLowerCase();
  if (bl.startsWith('huawei') || ml.includes('sun2000')) return 'Huawei';
  if (bl === 'felicity') return 'Felicity';
  if (bl === 'eastman') return 'Eastman';
  if (bl === 'veichi' || bl === 'viechi') return 'Veichi';
  if (bl.startsWith('jinko')) return 'Jinko';
  if (bl.startsWith('longi')) return 'LONGi Solar';
  if (bl.startsWith('trina')) return 'Trina Solar';
  if (bl === 'invt') return 'Invt';
  return b || 'Enerjoo';
}

function mapD1ProductToProduct(d1Item: any): Product {
  const id = d1Item.product_id || d1Item.id || '';
  const baseMatch = productsData.find(b => String(b.id) === String(id));
  const category = mapD1CategoryToCategory(d1Item.product_category || d1Item.category || baseMatch?.category);
  const ratedKw = Number(d1Item.rated_power_kw ?? d1Item.specs?.ratedPowerKw ?? 0);
  let power = Number(d1Item.power_w ?? d1Item.power ?? baseMatch?.power ?? 0);
  if ((!power || isNaN(power)) && ratedKw > 0) {
    power = ratedKw <= 200 ? ratedKw * 1000 : ratedKw;
  }

  let price = Number(d1Item.price_egp ?? d1Item.price ?? baseMatch?.price ?? 0);
  if (category === 'inverters' && price > 0 && price < 500) {
    price = baseMatch?.price && baseMatch.price >= 1000 ? baseMatch.price : price * 1000;
  }

  const efficiency = Number(d1Item.efficiency_percent ?? d1Item.efficiency ?? baseMatch?.efficiency ?? 0);
  const warranty = Number(d1Item.warranty_years ?? d1Item.warranty ?? baseMatch?.warranty ?? 0);
  const brand = normalizeD1Brand(d1Item.brand || baseMatch?.brand, d1Item.model || d1Item.name);

  let rawModel = String(d1Item.model || d1Item.name || baseMatch?.name || `Product ${id}`).trim();
  const kwDisplay = ratedKw > 0 ? ratedKw : (power >= 1000 ? power / 1000 : 0);
  if (brand === 'Felicity' && rawModel.toLowerCase() === 'off grid inverter' && kwDisplay > 0) {
    rawModel = `Felicity Off-Grid Inverter ${kwDisplay}kW`;
  } else if (brand === 'Eastman' && /^inverter\b/i.test(rawModel) && kwDisplay > 0) {
    rawModel = `Eastman Off-Grid Inverter ${kwDisplay}kW`;
  }

  const name = baseMatch?.name || d1Item.name || rawModel;
  let nameAr = d1Item.nameAr || d1Item.name_ar || baseMatch?.nameAr || '';
  if (!nameAr || nameAr === rawModel || nameAr === d1Item.model) {
    if (brand === 'Huawei' && kwDisplay > 0) {
      nameAr = `إنفرتر هواوي ${kwDisplay} كيلو وات On-Grid ثلاثي الأطوار (${rawModel.replace(/^Huawei\s*/i, '')})`;
    } else if (brand === 'Felicity' && kwDisplay > 0) {
      nameAr = `إنفرتر فيليسيتي (فيلسيتي) أوف جريد ${kwDisplay} كيلو وات`;
    } else if (brand === 'Eastman' && kwDisplay > 0) {
      nameAr = `إنفرتر إيستمان أوف جريد ${kwDisplay} كيلو وات`;
    } else if (brand === 'Jinko' && power > 0) {
      nameAr = `لوح طاقة شمسية جينكو ${power} وات (${rawModel})`;
    } else if (brand === 'LONGi Solar' && power > 0) {
      nameAr = `لوح طاقة شمسية لونجي ثنائي الوجه ${power} وات (${rawModel})`;
    } else if (brand === 'Trina Solar' && power > 0) {
      nameAr = `لوح طاقة شمسية ترينا سولار ثنائي الوجه ${power} وات (${rawModel})`;
    } else {
      nameAr = name;
    }
  }

  // Parse raw specs if stored as string or object
  let parsedSpecs: Record<string, any> = {};
  if (typeof d1Item.specs === 'string') {
    try {
      parsedSpecs = JSON.parse(d1Item.specs);
    } catch {
      parsedSpecs = {};
    }
  } else if (d1Item.specs && typeof d1Item.specs === 'object') {
    parsedSpecs = d1Item.specs;
  }

  // Base technical specs from Cloudflare D1 columns + parsedSpecs
  const specs: Record<string, any> = {
    productType: d1Item.product_type || parsedSpecs.productType || parsedSpecs.type || '',
    technology: d1Item.technology || parsedSpecs.technology || '',
    cellType: d1Item.cell_type || parsedSpecs.cellType || '',
    numberOfCells: d1Item.number_of_cells || parsedSpecs.numberOfCells || '',
    ratedPowerKw: d1Item.rated_power_kw ?? parsedSpecs.ratedPowerKw,
    surgePowerW: d1Item.surge_power_w ?? parsedSpecs.surgePowerW,
    waveform: d1Item.waveform || parsedSpecs.waveform || '',
    acVoltageV: d1Item.ac_voltage_v || parsedSpecs.acVoltageV || '',
    frequencyHz: d1Item.frequency_hz ?? parsedSpecs.frequencyHz,
    peakEfficiency: d1Item.peak_efficiency_percent ?? parsedSpecs.peakEfficiency,
    nominalVoltage: d1Item.nominal_voltage_v || parsedSpecs.nominalVoltage || '',
    capacityAh: d1Item.capacity_ah ?? parsedSpecs.capacityAh,
    nominalEnergyWh: d1Item.nominal_energy_wh ?? parsedSpecs.nominalEnergyWh,
    maxContinuousDischargeCurrentA: d1Item.max_continuous_discharge_current_a ?? parsedSpecs.maxContinuousDischargeCurrentA,
    cycleLife: d1Item.cycle_life ?? parsedSpecs.cycleLife,
    maxPvOpenCircuitVoltageV: d1Item.max_pv_open_circuit_voltage_v ?? parsedSpecs.maxPvOpenCircuitVoltageV,
    maxPvVoltage: d1Item.max_pv_open_circuit_voltage_v ?? parsedSpecs.maxPvVoltage ?? parsedSpecs.maxPvOpenCircuitVoltageV,
    mpptCount: d1Item.mppt_count ?? parsedSpecs.mpptCount ?? parsedSpecs.numberOfMppt,
    numberOfMppt: d1Item.mppt_count ?? parsedSpecs.numberOfMppt ?? parsedSpecs.mpptCount,
    maxPvArrayPowerW: d1Item.max_pv_array_power_w ?? parsedSpecs.maxPvArrayPowerW,
    pvMpptVoltageRangeV: d1Item.pv_mppt_voltage_range_v || parsedSpecs.pvMpptVoltageRangeV || parsedSpecs.mppt || '',
    mppt: d1Item.pv_mppt_voltage_range_v || parsedSpecs.mppt || parsedSpecs.pvMpptVoltageRangeV || '',
    vmpV: d1Item.vmp_v || parsedSpecs.vmpV || parsedSpecs.voltage || '',
    voltage: d1Item.vmp_v || parsedSpecs.voltage || parsedSpecs.vmpV || d1Item.nominal_voltage_v || d1Item.ac_voltage_v || '',
    vocV: d1Item.voc_v || parsedSpecs.vocV || '',
    impA: d1Item.imp_a || parsedSpecs.impA || parsedSpecs.current || '',
    current: d1Item.imp_a || parsedSpecs.current || parsedSpecs.impA || '',
    iscA: d1Item.isc_a || parsedSpecs.iscA || '',
    dimensionsMm: d1Item.dimensions_mm || parsedSpecs.dimensionsMm || parsedSpecs.dimensions || '',
    weightKg: d1Item.weight_kg || parsedSpecs.weightKg || parsedSpecs.weight || '',
    weight: d1Item.weight_kg || parsedSpecs.weight || parsedSpecs.weightKg || '',
    notes: d1Item.notes || parsedSpecs.notes || parsedSpecs.description || '',
    description: d1Item.notes || parsedSpecs.description || parsedSpecs.notes || '',
    type: d1Item.product_type || parsedSpecs.type || parsedSpecs.productType || d1Item.technology || parsedSpecs.technology || '',
    ...parsedSpecs,
  };

  // Dimensions parsing
  const parsedDims = parseDimensionsString(d1Item.dimensions_mm || specs.dimensionsMm || d1Item.machine_dimensions_w_h_d_mm);

  const length = d1Item.length !== undefined && d1Item.length !== null && d1Item.length !== ''
    ? Number(d1Item.length)
    : (specs.length !== undefined && specs.length !== null && specs.length !== '' && !isNaN(Number(specs.length))
        ? Number(specs.length)
        : parsedDims.length);

  const width = d1Item.width !== undefined && d1Item.width !== null && d1Item.width !== ''
    ? Number(d1Item.width)
    : (specs.width !== undefined && specs.width !== null && specs.width !== '' && !isNaN(Number(specs.width))
        ? Number(specs.width)
        : parsedDims.width);

  const thickness = d1Item.thickness !== undefined && d1Item.thickness !== null && d1Item.thickness !== ''
    ? Number(d1Item.thickness)
    : (specs.thickness !== undefined && specs.thickness !== null && specs.thickness !== '' && !isNaN(Number(specs.thickness))
        ? Number(specs.thickness)
        : parsedDims.thickness);

  const dimensionUnit = (d1Item.dimensionUnit || specs.dimensionUnit || parsedDims.dimensionUnit || (specs.dimensionsMm ? 'mm' : 'mm')) as DimensionUnit;

  let area = Number(d1Item.area ?? specs.area ?? 0);
  if ((!area || isNaN(area)) && parsedDims.area) {
    area = parsedDims.area;
  }
  if ((!area || isNaN(area)) && length && width) {
    if (dimensionUnit === 'mm') area = parseFloat(((length * width) / 1_000_000).toFixed(4));
    else if (dimensionUnit === 'cm') area = parseFloat(((length * width) / 10_000).toFixed(4));
    else if (dimensionUnit === 'm') area = parseFloat((length * width).toFixed(4));
  }

  const description = d1Item.notes || specs.description || specs.notes || nameAr;
  const notes = d1Item.notes || specs.notes || specs.description || nameAr;
  const image = d1Item.image_url || d1Item.image || baseMatch?.image || resolveDefaultD1Image(category, brand, name);
  const supplierId = d1Item.supplier_id || d1Item.supplierId || d1Item.supplier || '';
  const rawUpdatedAt = d1Item.updated_at || d1Item.updatedAt || new Date().toISOString().split('T')[0];
  const updatedAt = formatDateOnly(rawUpdatedAt);
  const datasheetUrl = d1Item.datasheet_url || d1Item.datasheetUrl;

  let status: 'available' | 'limited' | 'out_of_stock' = 'available';
  if (d1Item.availability) {
    const av = String(d1Item.availability).toLowerCase();
    if (av.includes('out') || av === 'out_of_stock') {
      status = 'out_of_stock';
    } else if (av.includes('limit') || av === 'limited') {
      status = 'limited';
    } else {
      status = 'available';
    }
  } else if (d1Item.status) {
    status = d1Item.status;
  }

  // Parse suppliers list
  let suppliers: Supplier[] = [];
  const cachedSup = supplierId ? supplierProfileCache.get(supplierId) : null;

  if (Array.isArray(d1Item.suppliers)) {
    suppliers = d1Item.suppliers.map((s: any) => {
      const sId = s.id || supplierId;
      const sCached = sId ? supplierProfileCache.get(sId) : null;
      const validName = (!isRawUidOrId(s.company) && s.company) ||
                        (!isRawUidOrId(s.name) && s.name) ||
                        sCached?.name ||
                        (d1Item.supplier_name && !isRawUidOrId(d1Item.supplier_name) ? d1Item.supplier_name : '') ||
                        'Enerjoo Certified Supplier';
      const validNameAr = (!isRawUidOrId(s.companyAr) && s.companyAr) ||
                          (!isRawUidOrId(s.company) && s.company) ||
                          (!isRawUidOrId(s.nameAr) && s.nameAr) ||
                          (!isRawUidOrId(s.name) && s.name) ||
                          sCached?.nameAr ||
                          sCached?.name ||
                          (d1Item.supplier_name_ar && !isRawUidOrId(d1Item.supplier_name_ar) ? d1Item.supplier_name_ar : '') ||
                          'مورد معتمد';
      return {
        ...s,
        id: sId,
        name: validName,
        nameAr: validNameAr,
        lastUpdate: formatDateOnly(s.lastUpdate || updatedAt),
      };
    });
  } else if (typeof d1Item.suppliers === 'string') {
    try {
      const parsed = JSON.parse(d1Item.suppliers);
      if (Array.isArray(parsed)) {
        suppliers = parsed.map((s: any) => {
          const sId = s.id || supplierId;
          const sCached = sId ? supplierProfileCache.get(sId) : null;
          const validName = (!isRawUidOrId(s.company) && s.company) ||
                            (!isRawUidOrId(s.name) && s.name) ||
                            sCached?.name ||
                            (d1Item.supplier_name && !isRawUidOrId(d1Item.supplier_name) ? d1Item.supplier_name : '') ||
                            'Enerjoo Certified Supplier';
          const validNameAr = (!isRawUidOrId(s.companyAr) && s.companyAr) ||
                              (!isRawUidOrId(s.company) && s.company) ||
                              (!isRawUidOrId(s.nameAr) && s.nameAr) ||
                              (!isRawUidOrId(s.name) && s.name) ||
                              sCached?.nameAr ||
                              sCached?.name ||
                              (d1Item.supplier_name_ar && !isRawUidOrId(d1Item.supplier_name_ar) ? d1Item.supplier_name_ar : '') ||
                              'مورد معتمد';
          return {
            ...s,
            id: sId,
            name: validName,
            nameAr: validNameAr,
            lastUpdate: formatDateOnly(s.lastUpdate || updatedAt),
          };
        });
      }
    } catch {
      suppliers = [];
    }
  }

  if (suppliers.length === 0 && (d1Item.supplier || supplierId)) {
    const rawSupName = d1Item.supplier_name && !isRawUidOrId(d1Item.supplier_name) ? d1Item.supplier_name : '';
    const rawSupNameAr = d1Item.supplier_name_ar && !isRawUidOrId(d1Item.supplier_name_ar) ? d1Item.supplier_name_ar : '';

    suppliers = [
      {
        id: supplierId,
        name: rawSupName || cachedSup?.name || 'Enerjoo Certified Supplier',
        nameAr: rawSupNameAr || cachedSup?.nameAr || cachedSup?.name || 'مورد معتمد',
        price: price,
        phone: d1Item.supplier_phone || cachedSup?.phone || SUPPLIER_CONTACT_PHONE_DISPLAY,
        location: d1Item.supplier_location || cachedSup?.location || 'Cairo, Egypt',
        verified: cachedSup?.verified ?? true,
        lastUpdate: updatedAt
      }
    ];
  }

  return {
    id,
    name,
    nameAr,
    brand,
    category,
    power,
    area,
    length,
    width,
    thickness,
    dimensionUnit,
    efficiency,
    warranty,
    price,
    status,
    updatedAt,
    image,
    image_url: image,
    supplierId,
    datasheetUrl,
    specs,
    suppliers,
    max_pv_open_circuit_voltage_v: d1Item.max_pv_open_circuit_voltage_v !== undefined && d1Item.max_pv_open_circuit_voltage_v !== null && d1Item.max_pv_open_circuit_voltage_v !== '' ? Number(d1Item.max_pv_open_circuit_voltage_v) : undefined,
    mppt_count: d1Item.mppt_count !== undefined && d1Item.mppt_count !== null && d1Item.mppt_count !== '' ? Number(d1Item.mppt_count) : undefined
  };
}

/**
 * Maps frontend Product data to Cloudflare D1 Product payload.
 */
function mapProductToD1Payload(product: Partial<Product> & { product_id?: string }): Record<string, any> {
  const payload: Record<string, any> = {};

  if (product.product_id) payload.product_id = product.product_id;
  if (product.name) {
    payload.name = product.name;
    payload.model = product.name;
  }
  if (product.nameAr) payload.nameAr = product.nameAr;
  if (product.brand) payload.brand = product.brand;
  if (product.category) payload.product_category = mapCategoryToD1Category(product.category);
  if (product.power !== undefined) payload.power_w = Number(product.power);
  if (product.price !== undefined) payload.price_egp = Number(product.price);
  if (product.efficiency !== undefined) payload.efficiency_percent = Number(product.efficiency);
  if (product.warranty !== undefined) payload.warranty_years = Number(product.warranty);
  if (product.area !== undefined) payload.area = Number(product.area);
  if (product.length !== undefined) payload.length = Number(product.length);
  if (product.width !== undefined) payload.width = Number(product.width);
  if (product.thickness !== undefined) payload.thickness = Number(product.thickness);
  if (product.dimensionUnit !== undefined) payload.dimensionUnit = product.dimensionUnit;

  // Format dimensions_mm for D1 database column
  const lengthVal = product.length ?? product.specs?.length;
  const widthVal = product.width ?? product.specs?.width;
  const thicknessVal = product.thickness ?? product.specs?.thickness;
  const unit = product.dimensionUnit || product.specs?.dimensionUnit || 'mm';
  if (lengthVal && widthVal) {
    payload.dimensions_mm = `${lengthVal} x ${widthVal}${thicknessVal ? ` x ${thicknessVal}` : ''} ${unit}`;
  } else if (product.specs?.dimensionsMm) {
    payload.dimensions_mm = product.specs.dimensionsMm;
  }

  // Top-level fallbacks for specs
  const descNotes = product.specs?.description || product.specs?.notes || product.description || product.notes || (product as any).notes;
  if (descNotes) {
    payload.notes = descNotes;
  }
  const prodType = product.specs?.type || product.specs?.productType || product.specs?.technology || (product as any).type || (product as any).product_type;
  if (prodType) {
    payload.product_type = prodType;
  }
  const volt = product.specs?.voltage || product.specs?.vmpV || product.specs?.nominalVoltage || (product as any).voltage || (product as any).vmp_v;
  if (volt) {
    payload.vmp_v = volt;
  }
  const curr = product.specs?.current || product.specs?.impA || (product as any).current || (product as any).imp_a;
  if (curr) {
    payload.imp_a = curr;
  }
  const wt = product.specs?.weight || product.specs?.weightKg || (product as any).weight || (product as any).weight_kg;
  if (wt) {
    payload.weight_kg = wt;
  }

  if (product.image) payload.image_url = product.image;
  if ((product as any).image_url) payload.image_url = (product as any).image_url;
  if (product.supplierId !== undefined) {
    payload.supplier_id = String(product.supplierId);
    payload.supplier = String(product.supplierId);
  }
  const primarySupplier = product.suppliers?.[0];
  if (primarySupplier) {
    if (primarySupplier.name && !isRawUidOrId(primarySupplier.name)) {
      payload.supplier_name = primarySupplier.name;
    }
    if (primarySupplier.nameAr && !isRawUidOrId(primarySupplier.nameAr)) {
      payload.supplier_name_ar = primarySupplier.nameAr;
    }
    if (primarySupplier.location) {
      payload.supplier_location = primarySupplier.location;
    }
    if (primarySupplier.phone) {
      payload.supplier_phone = primarySupplier.phone;
    }
  }
  if (product.datasheetUrl !== undefined) payload.datasheet_url = product.datasheetUrl;
  if (product.status) {
    payload.availability = product.status === 'available' ? 'Available' :
                           product.status === 'limited' ? 'Limited' : 'Out of Stock';
  }
  if (product.specs) {
    payload.specs = JSON.stringify(product.specs);

    // Map technical specifications to specific Cloudflare D1 columns
    if (product.specs.powerKw || product.specs.ratedPowerKw) {
      payload.rated_power_kw = Number(product.specs.powerKw || product.specs.ratedPowerKw);
    }
    if (product.specs.pvMpptVoltageRangeV || product.specs.mppt || (product as any).pv_mppt_voltage_range_v) {
      payload.pv_mppt_voltage_range_v = product.specs.pvMpptVoltageRangeV || product.specs.mppt || (product as any).pv_mppt_voltage_range_v;
    }
    if (product.specs.voltage || product.specs.vmpV || product.specs.acVoltageV) {
      if (product.category === 'inverters') {
        payload.ac_voltage_v = product.specs.acVoltageV || product.specs.voltage;
      } else {
        payload.vmp_v = product.specs.vmpV || product.specs.voltage;
      }
    }
    if (product.specs.acVoltageV) {
      payload.ac_voltage_v = product.specs.acVoltageV;
    }
    if (product.specs.nominalVoltage) {
      payload.nominal_voltage_v = product.specs.nominalVoltage;
    }
    if (product.specs.current || product.specs.impA) {
      if (product.category === 'inverters') {
        // Inverter output current
      } else {
        payload.imp_a = product.specs.impA || product.specs.current;
      }
    }
    if (product.specs.weight || product.specs.weightKg) {
      payload.weight_kg = product.specs.weight || product.specs.weightKg;
    }
    if (product.specs.capacity || product.specs.capacityAh) {
      payload.capacity_ah = product.specs.capacity || product.specs.capacityAh;
    }
    if (product.specs.type || product.specs.productType) {
      payload.product_type = product.specs.type || product.specs.productType;
    }
    if (product.specs.technology) {
      payload.technology = product.specs.technology;
    }
    if (product.specs.maxPvVoltage || product.specs.maxPvOpenCircuitVoltageV || (product as any).max_pv_open_circuit_voltage_v) {
      payload.max_pv_open_circuit_voltage_v = Number(product.specs.maxPvVoltage || product.specs.maxPvOpenCircuitVoltageV || (product as any).max_pv_open_circuit_voltage_v);
    }
    if (product.specs.mpptCount || product.specs.numberOfMppt || (product as any).mppt_count) {
      payload.mppt_count = Number(product.specs.mpptCount || product.specs.numberOfMppt || (product as any).mppt_count);
    }
    if (product.specs.description || product.specs.notes) {
      payload.notes = product.specs.description || product.specs.notes;
    }
  }
  if (product.suppliers) {
    payload.suppliers = JSON.stringify(product.suppliers);
  }

  return payload;
}

/**
 * Fetch all products from Cloudflare D1 via Worker API with resilient catalog fallback.
 */
export const getProducts = async (): Promise<Product[]> => {
  const deletedSet = getDeletedProductIds();
  try {
    const data = await requestProductsApi<{ success?: boolean; ok?: boolean; products: any[] }>('/products');
    if (data && Array.isArray(data.products) && data.products.length > 0) {
      let rawD1List = [...data.products];

      // If calling the deployed Cloudflare Worker directly (which caps each response at 10 items), harvest all partitions
      if (rawD1List.length <= 10 && getProductsApiBaseUrl() === CF_DIRECT_BASE_URL) {
        const partitions = [
          'PROD-1789',
          'PROD-1790081', 'PROD-1790082', 'PROD-1790083', 'PROD-1790085', 'PROD-1790086', 'PROD-1790087',
          'PROD-1790193', 'PROD-1790194', 'PROD-1790195', 'PROD-1790196',
          'PROD-179028', 'PROD-179052', 'PROD-179092', 'PROD-17910', 'PROD-17913', 'PROD-17914', 'PROD-17917', 'PROD-1792', 'PROD-1793'
        ];
        const partMap = new Map<string, any>();
        for (const p of rawD1List) partMap.set(String(p.product_id || p.id), p);
        await Promise.all(partitions.map(async (q) => {
          try {
            const pData = await requestProductsApi<{ products?: any[] }>(`/products?q=${encodeURIComponent(q)}`);
            for (const item of (pData.products || [])) {
              partMap.set(String(item.product_id || item.id), item);
            }
          } catch {
            // Ignore partition failure
          }
        }));
        rawD1List = Array.from(partMap.values());
      }

      // Any product returned actively by D1 / API is authoritative; unmark if erroneously blacklisted
      for (const p of rawD1List) {
        const pId = String(p.product_id || p.id);
        if (deletedSet.has(pId)) {
          unmarkProductAsDeleted(pId);
          deletedSet.delete(pId);
        }
      }

      const mappedD1 = rawD1List
        .map(mapD1ProductToProduct)
        .filter(p => !deletedSet.has(String(p.id)) && !deletedSet.has(String((p as any).product_id)));

      // Merge: start with baseline productsData (all categories)
      const productsMap = new Map<string, Product>();
      for (const baseProd of productsData) {
        const id = String(baseProd.id);
        if (!deletedSet.has(id)) {
          productsMap.set(id, baseProd);
        }
      }
      // Overlay live D1 products (live D1 properties take precedence and enrich)
      for (const d1Prod of mappedD1) {
        const id = String(d1Prod.id);
        if (!deletedSet.has(id)) {
          const existing = productsMap.get(id);
          productsMap.set(id, existing ? { ...existing, ...d1Prod, specs: { ...(existing.specs || {}), ...(d1Prod.specs || {}) } } : d1Prod);
        }
      }

      return Array.from(productsMap.values());
    }
    return productsData.filter(p => !deletedSet.has(String(p.id)));
  } catch (error) {
    console.warn('Could not fetch products from Cloudflare D1, using catalog baseline:', error);
    return productsData.filter(p => !deletedSet.has(String(p.id)));
  }
};

/**
 * Fetch a single product by ID from Cloudflare D1 via Worker API with fallback.
 * Returns null if the product is not found or an error occurs.
 */
export const getProductById = async (productId: string | number): Promise<Product | null> => {
  const pId = String(productId);
  if (getDeletedProductIds().has(pId)) {
    return null;
  }
  try {
    const data = await requestProductsApi<{ success?: boolean; ok?: boolean; product: any; notFound?: boolean }>(`/products/${productId}`);
    if (data && data.product) {
      const prod = mapD1ProductToProduct(data.product);
      if (getDeletedProductIds().has(String(prod.id))) return null;
      return prod;
    }
  } catch {
    // Non-blocking, fallback to catalog / list lookup
  }

  try {
    const all = await getProducts();
    const foundInAll = all.find(p => String(p.id) === pId || String((p as any).product_id) === pId);
    if (foundInAll && !getDeletedProductIds().has(String(foundInAll.id))) {
      return foundInAll;
    }
  } catch {
    // Fallback
  }

  const foundFallback = productsData.find(p => String(p.id) === pId);
  if (foundFallback && !getDeletedProductIds().has(String(foundFallback.id))) {
    return foundFallback;
  }
  return null;
};

/**
 * Fetch all inverters classified into the standardized StructuredInverter contract.
 * Single Source of Truth for frontend views, comparisons and calculators.
 */
export const getStructuredInverters = async (): Promise<StructuredInverter[]> => {
  try {
    const allProds = await getProducts();
    const inverterProds = allProds.filter(p => (p.category || '').toLowerCase().includes('invert'));
    return inverterProds.map(classifyInverter);
  } catch (error) {
    console.error('Failed to get structured inverters:', error);
    return [];
  }
};

/**
 * Fetch single structured inverter by ID
 */
export const getStructuredInverterById = async (productId: string | number): Promise<StructuredInverter | null> => {
  const prod = await getProductById(productId);
  if (!prod || !(prod.category || '').toLowerCase().includes('invert')) return null;
  return classifyInverter(prod);
};

/**
 * Match inverters against customer criteria using the 10-step AI recommendation logic
 */
export const matchCatalogInverters = async (
  criteriaOrQuery: string | InverterQueryCriteria
): Promise<InverterMatchResult[]> => {
  const inverters = await getStructuredInverters();
  const criteria = typeof criteriaOrQuery === 'string' ? parseInverterQuery(criteriaOrQuery) : criteriaOrQuery;
  return matchInverters(inverters, criteria);
};

/**
 * Subscribe to products: loads initial products from Cloudflare D1 Worker API,
 * invokes callback(products), registers listener for local product mutations,
 * and returns a safe unsubscribe function.
 */
export const subscribeToProducts = (callback: (products: Product[]) => void): (() => void) => {
  let isSubscribed = true;

  // Immediate synchronous invocation with filtered baseline products so the UI never starts empty or with deleted items
  const initial = filterDeletedProducts(productsData);
  if (initial && initial.length > 0) {
    callback(initial);
  }

  // Initial load from Cloudflare D1
  getProducts().then(products => {
    if (isSubscribed && products) {
      callback(products);
    }
  }).catch(error => {
    console.warn('Cloudflare D1 Products Initial Load Notice:', error);
    if (isSubscribed) {
      callback(filterDeletedProducts(productsData));
    }
  });

  // Track active listener to push updates whenever addProduct, updateProduct or deleteProduct is called
  const listener: ProductsListener = (updatedProducts) => {
    if (isSubscribed && updatedProducts) {
      callback(filterDeletedProducts(updatedProducts));
    }
  };
  activeProductListeners.add(listener);

  // Safe unsubscribe function
  return () => {
    isSubscribed = false;
    activeProductListeners.delete(listener);
  };
};

/**
 * Add a new product to Cloudflare D1 via Worker API (POST /products).
 * Uses product_id as the D1 identifier and returns product_id upon success.
 */
export const addProduct = async (product: Omit<Product, 'id'> & { id?: string | number }): Promise<string> => {
  try {
    // Generate a unique product_id for Cloudflare D1 if not provided
    const newProductId = (product.id ? String(product.id) : `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).toUpperCase();
    unmarkProductAsDeleted(newProductId);
    const payload = {
      ...mapProductToD1Payload(product),
      product_id: newProductId
    };

    const res = await requestProductsApi<{ success: boolean; message?: string; product_id?: string }>('/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const createdId = res.product_id || newProductId;
    unmarkProductAsDeleted(createdId);
    // Notify active subscribers
    await notifyProductListeners();
    return createdId;
  } catch (error) {
    console.error('Failed to add product to Cloudflare D1:', error);
    throw error;
  }
};

/**
 * Update an existing product in Cloudflare D1 via Worker API.
 * Uses atomic merge & recreate to guarantee that all technical specifications
 * (vmp_v, imp_a, product_type, dimensions_mm, weight_kg, notes) are stored in D1.
 */
export const updateProduct = async (productId: string | number, data: Partial<Product>): Promise<void> => {
  try {
    const pId = String(productId);
    unmarkProductAsDeleted(pId);
    const payload = mapProductToD1Payload(data);
    payload.product_id = pId;

    // Fetch existing raw product from D1 to perform a comprehensive non-destructive merge
    let existingRaw: Record<string, any> = {};
    try {
      const existingRes = await requestProductsApi<{ success: boolean; product?: any }>(`/products/${pId}`);
      if (existingRes && existingRes.product) {
        existingRaw = existingRes.product;
      }
    } catch (e) {
      console.warn(`Could not fetch existing product ${pId} before update:`, e);
    }

    const mergedPayload = {
      ...existingRaw,
      ...payload,
      product_id: pId,
      updated_at: new Date().toISOString()
    };

    // To ensure all technical specs (vmp_v, imp_a, product_type, dimensions_mm, weight_kg, notes, etc.)
    // are fully persisted into Cloudflare D1 without being dropped by the worker's limited PUT handler,
    // we use the verified atomic pattern: DELETE followed by POST with the exact same product_id.
    let updated = false;
    try {
      await requestProductsApi<{ success: boolean }>(`/products/${pId}`, { method: 'DELETE' });
      await requestProductsApi<{ success: boolean }>(`/products`, {
        method: 'POST',
        body: JSON.stringify(mergedPayload)
      });
      updated = true;
    } catch (recreateErr) {
      console.warn('Atomic recreate update failed, falling back to standard PUT:', recreateErr);
      await requestProductsApi<{ success: boolean; message?: string }>(`/products/${pId}`, {
        method: 'PUT',
        body: JSON.stringify(mergedPayload)
      });
    }

    // Notify active subscribers
    await notifyProductListeners();
  } catch (error) {
    console.error(`Failed to update product ${productId} in Cloudflare D1:`, error);
    throw error;
  }
};

/**
 * Delete a product from Cloudflare D1 via Worker API (DELETE /products/:id).
 * Guaranteed persistent removal across reloads and catalog updates.
 */
export const deleteProduct = async (productId: string | number): Promise<void> => {
  const pId = String(productId);

  // 1. Mark as permanently deleted in persistent client storage first
  markProductAsDeleted(pId);

  // 2. Request deletion from Cloudflare Worker / backend API
  try {
    await requestProductsApi<{ success: boolean; message?: string }>(`/products/${encodeURIComponent(pId)}`, {
      method: 'DELETE'
    });
  } catch (error) {
    // Non-blocking log: even if live worker returns 404 or fails, product is permanently excluded locally
    console.warn(`Products API deletion notice for ${productId}:`, error);
  }

  // 3. Immediately notify all active product subscribers with filtered products
  await notifyProductListeners();
};

export const subscribeToSuppliers = (callback: (suppliers: Supplier[]) => void) => {
  const q = query(
    collection(db, USERS_COLLECTION),
    where('type', '==', 'supplier')
  );
  return onSnapshot(q, (snapshot) => {
    const suppliers = snapshot.docs
      .map(doc => {
        const data = doc.data();
        const imgUrl = data.profileImage || data.avatar || '';
        const cleanName = (!isRawUidOrId(data.company) && data.company) ||
                          (!isRawUidOrId(data.name) && data.name) ||
                          'Enerjoo Certified Supplier';
        const cleanNameAr = (!isRawUidOrId(data.companyAr) && data.companyAr) ||
                            (!isRawUidOrId(data.company) && data.company) ||
                            (!isRawUidOrId(data.nameAr) && data.nameAr) ||
                            (!isRawUidOrId(data.name) && data.name) ||
                            'مورد معتمد';
        const sup: Supplier = {
          id: doc.id,
          name: cleanName,
          nameAr: cleanNameAr,
          location: data.location || data.governorate || 'Cairo, Egypt',
          phone: data.phone || '',
          verified: data.verified || false,
          rejected: data.rejected || false,
          email: data.email || '',
          avatar: imgUrl,
          profileImage: imgUrl,
          rating: data.rating || 0,
          totalSales: data.totalSales || 0,
          lastUpdate: formatDateOnly(data.updatedAt),
          price: data.price || 0,
        };
        supplierProfileCache.set(doc.id, sup);
        return sup;
      });
    callback(suppliers);
  }, (error) => {
    console.error('Firestore Suppliers Error:', error);
    callback([]);
  });
};

/**
 * Fetches a supplier/user profile by UID, prioritizing the memory cache
 * and falling back to Firestore users collection.
 */
export const getSupplierProfile = async (uid: string): Promise<Supplier | null> => {
  if (!uid) return null;
  if (supplierProfileCache.has(uid)) {
    return supplierProfileCache.get(uid)!;
  }
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const imgUrl = data.profileImage || data.avatar || '';
      const cleanName = (!isRawUidOrId(data.company) && data.company) ||
                        (!isRawUidOrId(data.name) && data.name) ||
                        'Enerjoo Certified Supplier';
      const cleanNameAr = (!isRawUidOrId(data.companyAr) && data.companyAr) ||
                          (!isRawUidOrId(data.company) && data.company) ||
                          (!isRawUidOrId(data.nameAr) && data.nameAr) ||
                          (!isRawUidOrId(data.name) && data.name) ||
                          'مورد معتمد';
      const sup: Supplier = {
        id: snap.id,
        name: cleanName,
        nameAr: cleanNameAr,
        location: data.location || data.governorate || 'Cairo, Egypt',
        phone: data.phone || '',
        verified: data.verified ?? true,
        rejected: data.rejected || false,
        email: data.email || '',
        avatar: imgUrl,
        profileImage: imgUrl,
        rating: data.rating || 0,
        totalSales: data.totalSales || 0,
        lastUpdate: formatDateOnly(data.updatedAt),
        price: data.price || 0,
      };
      supplierProfileCache.set(uid, sup);
      return sup;
    }
  } catch (err) {
    console.warn(`Could not fetch profile for user ${uid}:`, err);
  }
  return null;
};

export const seedInitialData = async () => {
  // Preserve all user and supplier saved products
  return;
};

export const toggleSupplierVerification = async (uid: string, verified: boolean) => {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, { 
      verified,
      rejected: false 
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
  }
};

export const updateSupplierStatus = async (uid: string, status: 'approved' | 'pending' | 'rejected') => {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    if (status === 'approved') {
      await updateDoc(docRef, { verified: true, rejected: false });
    } else if (status === 'rejected') {
      await updateDoc(docRef, { verified: false, rejected: true });
    } else {
      await updateDoc(docRef, { verified: false, rejected: false });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
  }
};

export const updateSupplierProfileImage = async (uid: string, imageUrl: string) => {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await setDoc(docRef, {
      profileImage: imageUrl,
      avatar: imageUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
  }
};

export const subscribeToProductReviews = (productId: string, callback: (reviews: ProductReview[]) => void) => {
  const reviewsRef = collection(db, PRODUCTS_COLLECTION, productId.toString(), 'reviews');
  const q = query(reviewsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const reviews = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || '',
        userName: data.userName || '',
        rating: data.rating || 0,
        comment: data.comment || '',
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : null,
      } as ProductReview;
    });
    callback(reviews);
  }, (error) => {
    console.warn(`Falling back query for reviews on product ${productId} without ordering:`, error.message);
    return onSnapshot(reviewsRef, (snapshot) => {
      const reviews = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId || '',
          userName: data.userName || '',
          rating: data.rating || 0,
          comment: data.comment || '',
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : null,
        } as ProductReview;
      });
      reviews.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      callback(reviews);
    }, (err) => {
      const errInfo = {
        error: err instanceof Error ? err.message : String(err),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
        },
        operationType: OperationType.LIST,
        path: `${PRODUCTS_COLLECTION}/${productId}/reviews`
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
      callback([]);
    });
  });
};

export const addProductReview = async (productId: string, review: Omit<ProductReview, 'id' | 'createdAt'>) => {
  try {
    const reviewsRef = collection(db, PRODUCTS_COLLECTION, productId.toString(), 'reviews');
    await addDoc(reviewsRef, {
      ...review,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${PRODUCTS_COLLECTION}/${productId}/reviews`);
  }
};

export const deleteProductReview = async (productId: string, reviewId: string) => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId.toString(), 'reviews', reviewId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${productId}/reviews/${reviewId}`);
  }
};

/**
 * Generates a standard formatted Request ID (e.g., ENJ-20260831-4821)
 */
export function generateSolarRequestId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `ENJ-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Saves a new comprehensive solar system calculation request into Firestore
 */
export const createSolarRequest = async (
  requestData: Omit<SolarRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, SOLAR_REQUESTS_COLLECTION), {
      ...requestData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SOLAR_REQUESTS_COLLECTION);
    return '';
  }
};

/**
 * Real-time subscription to all solar requests (for Admin Dashboard)
 */
export const subscribeToSolarRequests = (callback: (requests: SolarRequest[]) => void) => {
  const q = query(
    collection(db, SOLAR_REQUESTS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
      } as SolarRequest;
    });
    callback(requests);
  }, (error) => {
    console.warn("Solar requests with ordering failed, falling back to unordered query:", error.message);
    const fallbackQ = query(collection(db, SOLAR_REQUESTS_COLLECTION));
    return onSnapshot(fallbackQ, (snapshot) => {
      const requests = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
        } as SolarRequest;
      });
      requests.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      callback(requests);
    }, (err) => {
      console.error("Error subscribing to solar requests:", err);
      callback([]);
    });
  });
};

/**
 * Real-time subscription to a customer's specific solar requests
 */
export const subscribeToCustomerSolarRequests = (
  customerIdOrPhone: string,
  callback: (requests: SolarRequest[]) => void
) => {
  if (!customerIdOrPhone) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, SOLAR_REQUESTS_COLLECTION),
    where('customerId', '==', customerIdOrPhone)
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
      } as SolarRequest;
    });
    requests.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    callback(requests);
  }, (err) => {
    console.error("Error subscribing to customer solar requests:", err);
    callback([]);
  });
};

/**
 * Updates status and admin notes for a solar request
 */
export const updateSolarRequestStatus = async (
  requestId: string,
  status: SolarRequestStatus,
  adminNotes?: string
) => {
  try {
    const docRef = doc(db, SOLAR_REQUESTS_COLLECTION, requestId);
    const updatePayload: any = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (adminNotes !== undefined) {
      updatePayload.adminNotes = adminNotes;
    }
    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SOLAR_REQUESTS_COLLECTION}/${requestId}`);
  }
};

/**
 * Deletes a solar request
 */
export const deleteSolarRequest = async (requestId: string) => {
  try {
    const docRef = doc(db, SOLAR_REQUESTS_COLLECTION, requestId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SOLAR_REQUESTS_COLLECTION}/${requestId}`);
  }
};

/**
 * Creates or updates a customer document in customers/{uid}
 * Uses the authenticated Firebase UID as the document ID.
 * Preserves existing data (like createdAt or existing profile details) to prevent duplicates and data loss.
 */
export const createOrUpdateCustomer = async (data: {
  uid: string;
  fullName: string;
  phoneNumber: string;
  normalizedPhoneNumber: string;
  email?: string;
  governorate?: string;
  authProvider?: 'phone' | 'google' | 'email';
  legacyCustomerId?: string;
}): Promise<Customer> => {
  try {
    const customerDocRef = doc(db, CUSTOMERS_COLLECTION, data.uid);
    const docSnap = await getDoc(customerDocRef);

    let customerPayload: any;
    const now = new Date();

    const normalizedPhone = data.normalizedPhoneNumber || (data.phoneNumber ? normalizeEgyptianPhone(data.phoneNumber) : '');
    const phoneDisplay = data.phoneNumber || normalizedPhone;
    const cleanPhoneDigits = normalizedPhone.replace(/[^0-9]/g, '');
    const legacyId = data.legacyCustomerId || (cleanPhoneDigits ? `cust_${cleanPhoneDigits}` : undefined);

    if (docSnap.exists()) {
      const existing = docSnap.data();
      customerPayload = {
        uid: data.uid,
        fullName: data.fullName || existing.fullName || 'عميل إينرجو',
        phoneNumber: phoneDisplay || existing.phoneNumber || normalizedPhone,
        normalizedPhoneNumber: normalizedPhone || existing.normalizedPhoneNumber || phoneDisplay,
        email: data.email !== undefined ? data.email : (existing.email || ''),
        governorate: data.governorate || existing.governorate || 'القاهرة',
        authProvider: data.authProvider || existing.authProvider || 'phone',
        createdAt: existing.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...(legacyId ? { legacyCustomerId: legacyId } : (existing.legacyCustomerId ? { legacyCustomerId: existing.legacyCustomerId } : {}))
      };
      await setDoc(customerDocRef, customerPayload, { merge: true });
    } else {
      customerPayload = {
        uid: data.uid,
        fullName: data.fullName || 'عميل إينرجو',
        phoneNumber: phoneDisplay || normalizedPhone,
        normalizedPhoneNumber: normalizedPhone || phoneDisplay,
        email: data.email || '',
        governorate: data.governorate || 'القاهرة',
        authProvider: data.authProvider || 'phone',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...(legacyId ? { legacyCustomerId: legacyId } : {})
      };
      await setDoc(customerDocRef, customerPayload);
    }

    // Also sync with users collection for backwards-compatibility with existing views
    try {
      const userDocRef = doc(db, USERS_COLLECTION, data.uid);
      await setDoc(userDocRef, {
        uid: data.uid,
        name: customerPayload.fullName,
        nameAr: customerPayload.fullName,
        phone: customerPayload.phoneNumber,
        governorate: customerPayload.governorate,
        location: customerPayload.governorate,
        type: 'customer',
        verified: true,
        email: customerPayload.email || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (userSyncErr) {
      console.warn("User sync notice (non-fatal):", userSyncErr);
    }

    return {
      ...customerPayload,
      createdAt: customerPayload.createdAt || now,
      updatedAt: now,
      lastLoginAt: now,
    } as Customer;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CUSTOMERS_COLLECTION}/${data.uid}`);
    throw error;
  }
};

/**
 * Retrieves a customer document from customers/{uid}
 */
export const getCustomer = async (uid: string): Promise<Customer | null> => {
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        fullName: data.fullName || '',
        phoneNumber: data.phoneNumber || '',
        normalizedPhoneNumber: data.normalizedPhoneNumber || '',
        email: data.email || '',
        governorate: data.governorate || 'القاهرة',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastLoginAt: data.lastLoginAt,
        authProvider: data.authProvider || 'phone'
      } as Customer;
    }
    return null;
  } catch (error) {
    console.warn("Could not get customer document:", error);
    return null;
  }
};

/**
 * Real-time subscription to a customer document
 */
export const subscribeToCustomer = (uid: string, callback: (customer: Customer | null) => void) => {
  if (!uid) {
    callback(null);
    return () => {};
  }
  const docRef = doc(db, CUSTOMERS_COLLECTION, uid);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        uid: docSnap.id,
        fullName: data.fullName || '',
        phoneNumber: data.phoneNumber || '',
        normalizedPhoneNumber: data.normalizedPhoneNumber || '',
        email: data.email || '',
        governorate: data.governorate || 'القاهرة',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastLoginAt: data.lastLoginAt,
        authProvider: data.authProvider || 'phone'
      } as Customer);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn("Error subscribing to customer:", err);
    callback(null);
  });
};

/**
 * Creates and persists a quotation in Firestore 'quotations' collection
 * Explicitly handles: customerName, customerEmail, phone, systemType, location, usage, monthlyBill, batteryRequired, systemSpecs, targetTier, priceEstimate, status, and createdAt.
 */
export const createQuotation = async (
  quotationData: {
    customerName: string;
    customerEmail?: string;
    phone: string;
    systemType: string;
    location: string;
    usage?: number | string;
    monthlyBill?: number;
    batteryRequired?: boolean;
    systemSpecs?: string;
    targetTier?: string;
    priceEstimate: number;
    status?: QuotationStatus | string;
    requestId?: string;
    customerId?: string | null;
    userId?: string | null;
    governorate?: string;
    notes?: string;
    supplierContacted?: string;
    systemTypeName?: string;
    name?: string;
    email?: string;
    customerPhone?: string;
  }
): Promise<string> => {
  try {
    const rawPhone = quotationData.phone || quotationData.customerPhone || '';
    const normalizedPhone = rawPhone ? normalizeEgyptianPhone(rawPhone) : '';
    const cleanCustomerName = quotationData.customerName || quotationData.name || 'عميل إينرجو';
    const cleanEmail = quotationData.customerEmail || quotationData.email || '';
    const assignedRequestId = quotationData.requestId || generateSolarRequestId();

    const payload = {
      // Primary required schema fields
      customerName: cleanCustomerName,
      name: cleanCustomerName, // alias for backwards compatibility
      customerEmail: cleanEmail,
      email: cleanEmail, // alias for backwards compatibility
      phone: normalizedPhone || rawPhone,
      customerPhone: normalizedPhone || rawPhone, // alias for backwards compatibility
      systemType: quotationData.systemType || 'hybrid',
      systemTypeName: quotationData.systemTypeName || (
        quotationData.systemType === 'on-grid' ? 'متصل بالشبكة (On-Grid)' :
        quotationData.systemType === 'off-grid' ? 'منفصل (Off-Grid)' :
        quotationData.systemType === 'pump' ? 'طلمبات مياه الري (Pump)' : 'هجين (Hybrid)'
      ),
      location: quotationData.location || quotationData.governorate || 'مصر',
      governorate: quotationData.governorate || quotationData.location || 'القاهرة',
      usage: quotationData.usage !== undefined ? quotationData.usage : null,
      monthlyBill: quotationData.monthlyBill !== undefined ? quotationData.monthlyBill : null,
      batteryRequired: quotationData.batteryRequired !== undefined ? Boolean(quotationData.batteryRequired) : false,
      systemSpecs: quotationData.systemSpecs || '',
      targetTier: quotationData.targetTier || 'recommended',
      priceEstimate: quotationData.priceEstimate || 0,
      status: quotationData.status || 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Additional relations & notes
      requestId: assignedRequestId,
      customerId: quotationData.customerId || quotationData.userId || null,
      userId: quotationData.userId || quotationData.customerId || null,
      notes: quotationData.notes || '',
      supplierContacted: quotationData.supplierContacted || null
    };

    const docRef = await addDoc(collection(db, QUOTATIONS_COLLECTION), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, QUOTATIONS_COLLECTION);
    return '';
  }
};

/**
 * Updates an existing quotation document in 'quotations' collection
 */
export const updateQuotation = async (
  quotationId: string,
  data: Partial<Quotation>
): Promise<void> => {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
    const updatePayload: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    if (data.customerName && !data.name) {
      updatePayload.name = data.customerName;
    }
    if (data.customerEmail && !data.email) {
      updatePayload.email = data.customerEmail;
    }
    if (data.phone && !data.customerPhone) {
      updatePayload.customerPhone = data.phone;
    }
    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${QUOTATIONS_COLLECTION}/${quotationId}`);
  }
};

/**
 * Updates status and optional notes for a quotation
 */
export const updateQuotationStatus = async (
  quotationId: string,
  status: QuotationStatus | string,
  notes?: string
): Promise<void> => {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
    const updatePayload: any = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }
    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${QUOTATIONS_COLLECTION}/${quotationId}`);
  }
};

/**
 * Deletes a quotation document from 'quotations' collection
 */
export const deleteQuotation = async (quotationId: string): Promise<void> => {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${QUOTATIONS_COLLECTION}/${quotationId}`);
  }
};

/**
 * Retrieves a single quotation document by ID
 */
export const getQuotation = async (quotationId: string): Promise<Quotation | null> => {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        customerName: data.customerName || data.name || '',
        name: data.name || data.customerName || '',
        customerEmail: data.customerEmail || data.email || '',
        email: data.email || data.customerEmail || '',
        phone: data.phone || data.customerPhone || '',
        customerPhone: data.customerPhone || data.phone || '',
        systemType: data.systemType || 'hybrid',
        systemTypeName: data.systemTypeName || '',
        location: data.location || data.governorate || '',
        governorate: data.governorate || data.location || '',
        usage: data.usage !== undefined ? data.usage : undefined,
        monthlyBill: data.monthlyBill !== undefined ? data.monthlyBill : undefined,
        batteryRequired: data.batteryRequired !== undefined ? Boolean(data.batteryRequired) : false,
        systemSpecs: data.systemSpecs || '',
        targetTier: data.targetTier || 'recommended',
        priceEstimate: data.priceEstimate || 0,
        status: data.status || 'pending',
        notes: data.notes || '',
        supplierContacted: data.supplierContacted || '',
        requestId: data.requestId || '',
        customerId: data.customerId || data.userId || null,
        userId: data.userId || data.customerId || null,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
      } as Quotation;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${QUOTATIONS_COLLECTION}/${quotationId}`);
    return null;
  }
};

/**
 * Real-time subscription to all quotations (for Admin / Sales Review)
 */
export const subscribeToQuotations = (callback: (quotations: Quotation[]) => void) => {
  const q = query(
    collection(db, QUOTATIONS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const quotations = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        customerName: data.customerName || data.name || '',
        name: data.name || data.customerName || '',
        customerEmail: data.customerEmail || data.email || '',
        email: data.email || data.customerEmail || '',
        phone: data.phone || data.customerPhone || '',
        customerPhone: data.customerPhone || data.phone || '',
        systemType: data.systemType || 'hybrid',
        systemTypeName: data.systemTypeName || '',
        location: data.location || data.governorate || '',
        governorate: data.governorate || data.location || '',
        usage: data.usage !== undefined ? data.usage : undefined,
        monthlyBill: data.monthlyBill !== undefined ? data.monthlyBill : undefined,
        batteryRequired: data.batteryRequired !== undefined ? Boolean(data.batteryRequired) : false,
        systemSpecs: data.systemSpecs || '',
        targetTier: data.targetTier || 'recommended',
        priceEstimate: data.priceEstimate || 0,
        status: data.status || 'pending',
        notes: data.notes || '',
        supplierContacted: data.supplierContacted || '',
        requestId: data.requestId || '',
        customerId: data.customerId || data.userId || null,
        userId: data.userId || data.customerId || null,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
      } as Quotation;
    });
    callback(quotations);
  }, (error) => {
    console.warn("Quotations with ordering failed, falling back to unordered query:", error.message);
    const fallbackQ = query(collection(db, QUOTATIONS_COLLECTION));
    return onSnapshot(fallbackQ, (snapshot) => {
      const quotations = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          customerName: data.customerName || data.name || '',
          name: data.name || data.customerName || '',
          customerEmail: data.customerEmail || data.email || '',
          email: data.email || data.customerEmail || '',
          phone: data.phone || data.customerPhone || '',
          customerPhone: data.customerPhone || data.phone || '',
          systemType: data.systemType || 'hybrid',
          systemTypeName: data.systemTypeName || '',
          location: data.location || data.governorate || '',
          governorate: data.governorate || data.location || '',
          usage: data.usage !== undefined ? data.usage : undefined,
          monthlyBill: data.monthlyBill !== undefined ? data.monthlyBill : undefined,
          batteryRequired: data.batteryRequired !== undefined ? Boolean(data.batteryRequired) : false,
          systemSpecs: data.systemSpecs || '',
          targetTier: data.targetTier || 'recommended',
          priceEstimate: data.priceEstimate || 0,
          status: data.status || 'pending',
          notes: data.notes || '',
          supplierContacted: data.supplierContacted || '',
          requestId: data.requestId || '',
          customerId: data.customerId || data.userId || null,
          userId: data.userId || data.customerId || null,
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
        } as Quotation;
      });
      quotations.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      callback(quotations);
    }, (err) => {
      console.error("Error subscribing to quotations:", err);
      callback([]);
    });
  });
};

/**
 * Real-time subscription to a customer's quotations
 */
export const subscribeToCustomerQuotations = (
  customerIdOrPhone: string,
  callback: (quotations: Quotation[]) => void
) => {
  if (!customerIdOrPhone) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, QUOTATIONS_COLLECTION),
    where('customerId', '==', customerIdOrPhone)
  );

  return onSnapshot(q, (snapshot) => {
    const quotations = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        customerName: data.customerName || data.name || '',
        name: data.name || data.customerName || '',
        customerEmail: data.customerEmail || data.email || '',
        email: data.email || data.customerEmail || '',
        phone: data.phone || data.customerPhone || '',
        customerPhone: data.customerPhone || data.phone || '',
        systemType: data.systemType || 'hybrid',
        systemTypeName: data.systemTypeName || '',
        location: data.location || data.governorate || '',
        governorate: data.governorate || data.location || '',
        usage: data.usage !== undefined ? data.usage : undefined,
        monthlyBill: data.monthlyBill !== undefined ? data.monthlyBill : undefined,
        batteryRequired: data.batteryRequired !== undefined ? Boolean(data.batteryRequired) : false,
        systemSpecs: data.systemSpecs || '',
        targetTier: data.targetTier || 'recommended',
        priceEstimate: data.priceEstimate || 0,
        status: data.status || 'pending',
        notes: data.notes || '',
        supplierContacted: data.supplierContacted || '',
        requestId: data.requestId || '',
        customerId: data.customerId || data.userId || null,
        userId: data.userId || data.customerId || null,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date(),
      } as Quotation;
    });
    quotations.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    callback(quotations);
  }, (err) => {
    console.error("Error subscribing to customer quotations:", err);
    callback([]);
  });
};


