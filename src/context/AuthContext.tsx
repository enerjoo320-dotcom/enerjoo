import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { User } from "../types";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, additionalData?: any) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (role?: 'customer' | 'supplier') => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          let isVerified = data.verified || firebaseUser.emailVerified;
          
          // Sync if changed
          if (firebaseUser.emailVerified && !data.verified) {
            await setDoc(userDocRef, { verified: true }, { merge: true });
            isVerified = true;
          }

          setUser({ uid: firebaseUser.uid, ...data, verified: isVerified } as User);
        } else {
          // If doc doesn't exist but user is logged in (shouldn't happen with our flow but for safety)
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: "User",
            nameAr: "مستخدم",
            type: "customer"
          } as User);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const register = async (email: string, password: string, additionalData: any = {}) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    
    try {
      await sendEmailVerification(res.user);
    } catch (err) {
      console.error("Error sending verification email:", err);
    }

    const adminEmails = ['enerjoo320@gmail.com', 'eng.faressnasser@gmail.com', 'faressnasser12@gmail.com'];
    const userRole = adminEmails.includes(email.toLowerCase()) ? 'admin' : (additionalData.type || "customer");
    
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
      verified: userRole === 'admin' ? true : false,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, "users", res.user.uid), userData);
    setUser(userData);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async (role: 'customer' | 'supplier' = 'customer') => {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    const userDocRef = doc(db, "users", res.user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const adminEmails = ['enerjoo320@gmail.com', 'eng.faressnasser@gmail.com', 'faressnasser12@gmail.com'];
      const userRole = res.user.email && adminEmails.includes(res.user.email.toLowerCase()) ? 'admin' : role;
      
      const userData: User = {
        uid: res.user.uid,
        email: res.user.email || "",
        name: res.user.displayName || "User",
        nameAr: res.user.displayName || "مستخدم جديد",
        type: userRole,
        company: "",
        location: "Cairo, Egypt",
        phone: "",
        avatar: res.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${res.user.uid}`,
        // Admin accounts or non-suppliers (customers) signing in with Google are verified immediately.
        // Suppliers registering with Google still require admin approval (verified: false).
        verified: userRole === 'admin' || userRole === 'customer',
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, userData);
      setUser(userData);
    } else {
      setUser({ uid: res.user.uid, ...userDoc.data() } as User);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
