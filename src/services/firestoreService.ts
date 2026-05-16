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
  where
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Supplier } from '../types';
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
    handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
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
    handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
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
    await updateDoc(docRef, { verified });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${uid}`);
  }
};
