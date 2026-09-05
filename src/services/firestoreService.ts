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
import { Product, Supplier, ProductReview, SolarRequest, SolarRequestStatus, Customer, Quotation, QuotationStatus } from '../types';
import { normalizeEgyptianPhone } from '../utils/phoneUtils';

const PRODUCTS_COLLECTION = 'products';
const USERS_COLLECTION = 'users';
const SOLAR_REQUESTS_COLLECTION = 'solarRequests';
const CUSTOMERS_COLLECTION = 'customers';
const QUOTATIONS_COLLECTION = 'quotations';

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

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  const q = query(collection(db, PRODUCTS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
    callback(products);
  }, (error) => {
    console.error('Firestore Products Error:', error);
    callback([]);
  });
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
        return {
          id: doc.id,
          name: data.name || '',
          nameAr: data.nameAr || '',
          location: data.location || '',
          phone: data.phone || '',
          verified: data.verified || false,
          rejected: data.rejected || false,
          email: data.email || '',
          avatar: imgUrl,
          profileImage: imgUrl,
          rating: data.rating || 0,
          totalSales: data.totalSales || 0,
          lastUpdate: data.updatedAt || '',
          price: data.price || 0,
        };
      });
    callback(suppliers);
  }, (error) => {
    console.error('Firestore Suppliers Error:', error);
    callback([]);
  });
};

export const seedInitialData = async () => {
  // Clear any existing products from Firestore as requested by user
  try {
    const productsSnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    if (!productsSnapshot.empty) {
      for (const productDoc of productsSnapshot.docs) {
        try {
          await deleteDoc(doc(db, PRODUCTS_COLLECTION, productDoc.id));
        } catch (delErr) {
          console.warn("Could not delete product doc:", productDoc.id, delErr);
        }
      }
    }
  } catch (error) {
    console.error("Error during product cleanup:", error);
  }
};

export const addProduct = async (product: Omit<Product, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      ...product,
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
    return '';
  }
};

export const updateProduct = async (productId: string, data: Partial<Product>) => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${productId}`);
  }
};

export const deleteProduct = async (productId: string) => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${productId}`);
  }
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


