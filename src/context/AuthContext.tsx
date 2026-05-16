import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { User } from "../types";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string, additionalData?: any) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
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

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
