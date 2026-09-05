import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { User } from "../types";
import { safeLocalStorage } from "../utils/safeStorage";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, additionalData?: any) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (role?: 'customer' | 'supplier') => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const EXCLUDED_ADMIN_EMAILS = [
  'enerjoo320@gmail.com',
  'eng.faressnasser@gmail.com',
  'faressnasser12@gmail.com'
];

const checkIsAdminEmail = (emailStr: string | null | undefined): boolean => {
  if (!emailStr) return false;
  const clean = emailStr.toLowerCase().trim();
  if (EXCLUDED_ADMIN_EMAILS.includes(clean)) {
    return false;
  }
  return clean === 'enerjoo365@gmail.com';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (firebaseUser) {
        // Clear mock local auth
        safeLocalStorage.removeItem("enerjoo_mock_auth_uid");
        
        // 1. Sync customer record in customers/{uid}
        try {
          const custDocRef = doc(db, "customers", firebaseUser.uid);
          const custDocSnap = await getDoc(custDocRef);
          if (!custDocSnap.exists()) {
            await setDoc(custDocRef, {
              uid: firebaseUser.uid,
              fullName: firebaseUser.displayName || 'عميل إينرجو',
              email: firebaseUser.email || '',
              authProvider: 'google',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            }, { merge: true });
          } else {
            await setDoc(custDocRef, {
              lastLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (custCheckErr) {
          console.warn("Notice checking customers collection:", custCheckErr);
        }

        const userDocRef = doc(db, "users", firebaseUser.uid);
        unsubUserDoc = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            const emailStr = (firebaseUser.email || "").toLowerCase();
            const isAdminEmail = checkIsAdminEmail(emailStr);
            const isExcluded = EXCLUDED_ADMIN_EMAILS.includes(emailStr);

            if (isAdminEmail && data.type !== 'admin') {
              await setDoc(userDocRef, { type: 'admin', verified: true }, { merge: true });
              data.type = 'admin';
              data.verified = true;
            } else if (isExcluded && data.type === 'admin') {
              // Revoke admin permissions
              await setDoc(userDocRef, { type: 'customer' }, { merge: true });
              data.type = 'customer';
            }

            let isVerified = data.type === 'customer' || data.type === 'admin' || data.verified || firebaseUser.emailVerified;
            
            // Sync if changed
            if ((data.type === 'customer' || data.type === 'admin') && !data.verified) {
              await setDoc(userDocRef, { verified: true }, { merge: true });
              isVerified = true;
            }

            setUser({ 
              uid: firebaseUser.uid, 
              name: data.name || firebaseUser.displayName || 'User',
              nameAr: data.nameAr || firebaseUser.displayName || 'مستخدم',
              email: data.email || firebaseUser.email || '',
              avatar: data.avatar || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
              ...data, 
              verified: isVerified 
            } as User);
          } else {
            const emailStr = (firebaseUser.email || "").toLowerCase();
            const isAdminEmail = checkIsAdminEmail(emailStr);
            const userRole = isAdminEmail ? 'admin' : 'customer';

            const newUserData: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              name: firebaseUser.displayName || "User",
              nameAr: firebaseUser.displayName || "مستخدم",
              type: userRole,
              phone: firebaseUser.phoneNumber || "",
              avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
              verified: true,
              createdAt: new Date().toISOString()
            };

            try {
              await setDoc(userDocRef, newUserData, { merge: true });
            } catch (saveErr) {
              console.warn("Could not save initial user doc:", saveErr);
            }
            setUser(newUserData);
          }
          setLoading(false);
        }, (err) => {
          console.error("User snapshot listening error:", err);
          setLoading(false);
        });
      } else {
        // Check for local mock auth session
        const mockUid = safeLocalStorage.getItem("enerjoo_mock_auth_uid");
        if (mockUid) {
          const userDocRef = doc(db, "users", mockUid);
          unsubUserDoc = onSnapshot(userDocRef, (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              const mockEmail = (data.email || '').toLowerCase();
              if (EXCLUDED_ADMIN_EMAILS.includes(mockEmail) && data.type === 'admin') {
                data.type = 'customer';
                setDoc(doc(db, "users", mockUid), { type: 'customer' }, { merge: true });
              }
              setUser({ uid: mockUid, ...data } as User);
            } else {
              setUser(null);
              safeLocalStorage.removeItem("enerjoo_mock_auth_uid");
            }
            setLoading(false);
          }, (err) => {
            console.error("Mock user snapshot error:", err);
            setUser(null);
            setLoading(false);
          });
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const register = async (email: string, password: string, additionalData: any = {}) => {
    const emailStr = email.toLowerCase();
    const isAdminEmail = checkIsAdminEmail(emailStr);
    const userRole = isAdminEmail ? 'admin' : (additionalData.type || "customer");

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      const userData: User = {
        uid: res.user.uid,
        email: email,
        name: additionalData.name || "User",
        nameAr: additionalData.nameAr || additionalData.name || "مستخدم",
        type: userRole,
        company: additionalData.company || "",
        location: additionalData.location || "Cairo, Egypt",
        phone: additionalData.phone || "",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${res.user.uid}`,
        verified: userRole === 'admin' || userRole === 'customer',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", res.user.uid), userData);
      setUser(userData);
    } catch (err: any) {
      const isNotAllowed = err.code === 'auth/operation-not-allowed' || 
                           err.message?.includes('auth/operation-not-allowed');
      if (isNotAllowed) {
        console.warn("Email/Password Auth disabled in Firebase. Sandbox fallback activated.");
        
        const cleanEmail = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
        const mockUid = `mock_${cleanEmail}_${Math.floor(1000 + Math.random() * 9000)}`;

        const userData: User = {
          uid: mockUid,
          email: email,
          name: additionalData.name || "User",
          nameAr: additionalData.nameAr || additionalData.name || "مستخدم",
          type: userRole,
          company: additionalData.company || "",
          location: additionalData.location || "Cairo, Egypt",
          phone: additionalData.phone || "",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUid}`,
          verified: true,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "users", mockUid), userData);
        safeLocalStorage.setItem("enerjoo_mock_auth_uid", mockUid);
        setUser(userData);
      } else {
        throw err;
      }
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const isNotAllowed = err.code === 'auth/operation-not-allowed' || 
                           err.message?.includes('auth/operation-not-allowed');
      if (isNotAllowed) {
        console.warn("Email/Password Auth is disabled or misconfigured in Firebase. Logging in via Sandbox fallback.");
        
        const q = query(collection(db, "users"), where("email", "==", email.toLowerCase().trim()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          const mockUid = userDoc.id;
          const emailStr = email.toLowerCase();
          if (EXCLUDED_ADMIN_EMAILS.includes(emailStr) && userData.type === 'admin') {
            userData.type = 'customer';
            await setDoc(doc(db, "users", mockUid), { type: 'customer' }, { merge: true });
          }
          safeLocalStorage.setItem("enerjoo_mock_auth_uid", mockUid);
          setUser({ uid: mockUid, ...userData } as User);
        } else {
          console.log("No existing user found for mock login. Dynamic provisioning initiated.");
          const cleanEmail = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
          const mockUid = `mock_${cleanEmail}_${Math.floor(1000 + Math.random() * 9000)}`;
          const emailStr = email.toLowerCase();
          const isAdminEmail = checkIsAdminEmail(emailStr);
          const userRole = isAdminEmail ? 'admin' : "customer";

          const userData: User = {
            uid: mockUid,
            email: email,
            name: email.split('@')[0],
            nameAr: email.split('@')[0],
            type: userRole,
            company: "",
            location: "Cairo, Egypt",
            phone: "",
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUid}`,
            verified: true,
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, "users", mockUid), userData);
          safeLocalStorage.setItem("enerjoo_mock_auth_uid", mockUid);
          setUser(userData);
        }
      } else {
        throw err;
      }
    }
  };

  const signInWithGoogle = async (role: 'customer' | 'supplier' = 'customer') => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const res = await signInWithPopup(auth, provider);
      if (!res || !res.user) return;

      const firebaseUser = res.user;
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      const emailStr = (firebaseUser.email || "").toLowerCase();
      const isAdminEmail = checkIsAdminEmail(emailStr);
      const userRole = isAdminEmail ? 'admin' : role;

      if (!userDoc.exists()) {
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "User",
          nameAr: firebaseUser.displayName || "مستخدم جديد",
          type: userRole,
          company: "",
          location: "Cairo, Egypt",
          phone: "",
          avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
          verified: true,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, userData);
        setUser(userData);
      } else {
        const data = userDoc.data();
        if (EXCLUDED_ADMIN_EMAILS.includes(emailStr) && data.type === 'admin') {
          data.type = 'customer';
          await setDoc(userDocRef, { type: 'customer' }, { merge: true });
        }
        setUser({ 
          uid: firebaseUser.uid, 
          name: firebaseUser.displayName || data.name || 'User',
          nameAr: firebaseUser.displayName || data.nameAr || 'مستخدم',
          email: firebaseUser.email || data.email || '',
          avatar: firebaseUser.photoURL || data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
          ...data 
        } as User);
      }

      // Also ensure customer record is registered in customers/{uid}
      try {
        const custDocRef = doc(db, "customers", firebaseUser.uid);
        await setDoc(custDocRef, {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || 'عميل إينرجو',
          email: firebaseUser.email || '',
          authProvider: 'google',
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        }, { merge: true });
      } catch (custErr) {
        console.warn("Customer sync notice:", custErr);
      }

    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.info("Google Sign In popup was closed or cancelled by the user.");
        return;
      }
      throw err;
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Also update customers/{uid} if customer
      if (user.type === 'customer') {
        const custDocRef = doc(db, "customers", user.uid);
        await setDoc(custDocRef, {
          fullName: data.name || data.nameAr || user.name,
          phoneNumber: data.phone || user.phone || '',
          governorate: data.governorate || user.governorate || 'القاهرة',
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error updating user document in Firestore:", err);
    }
  };

  const logout = async () => {
    await signOut(auth);
    safeLocalStorage.removeItem("enerjoo_mock_auth_uid");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      register, 
      login, 
      signInWithGoogle, 
      updateUserProfile, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
