import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot,
  serverTimestamp,
  where,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Supplier, ProductReview } from '../types';
import { productsData } from '../data/mockData';

const PRODUCTS_COLLECTION = 'products';
const USERS_COLLECTION = 'users';

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
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType: OperationType.LIST,
      path: PRODUCTS_COLLECTION
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    console.warn("Falling back to local static solar products catalog.");
    callback(productsData);
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
        return {
          id: doc.id,
          name: data.name || '',
          nameAr: data.nameAr || '',
          location: data.location || '',
          phone: data.phone || '',
          verified: data.verified || false,
          rejected: data.rejected || false,
          email: data.email || '',
          avatar: data.avatar || '',
          rating: data.rating || 0,
          totalSales: data.totalSales || 0,
          lastUpdate: data.updatedAt || '',
          price: data.price || 0,
        };
      });
    callback(suppliers);
  }, (error) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType: OperationType.LIST,
      path: USERS_COLLECTION
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    console.warn("Falling back to local static suppliers database.");
    
    // Dynamically build supplier list from productsData
    const fallbackSuppliers: Supplier[] = [];
    productsData.forEach(p => {
      p.suppliers.forEach(s => {
        if (!fallbackSuppliers.some(existing => existing.id === s.id)) {
          fallbackSuppliers.push(s);
        }
      });
    });
    callback(fallbackSuppliers);
  });
};

export const seedInitialData = async () => {
  try {
    const productsSnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    if (productsSnapshot.empty) {
      if (!auth.currentUser) {
        console.log("Seeding skipped: No authenticated user to perform writes.");
        return;
      }

      console.log("Seeding initial products...");
      for (const p of productsData) {
        const { id, ...productWithoutId } = p;
        const normalizedProduct = {
          ...productWithoutId,
          supplierId: String(productWithoutId.supplierId),
          updatedAt: serverTimestamp()
        };
        try {
          await addDoc(collection(db, PRODUCTS_COLLECTION), normalizedProduct);
        } catch (e: any) {
          if (e.code === 'permission-denied') {
            console.warn("Seeding failed for a product due to permissions. You may need to sign in as an admin.");
            break;
          }
          throw e;
        }
      }
    }
  } catch (error) {
    console.error("Error checking or seeding data:", error);
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
