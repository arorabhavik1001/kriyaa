import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  userId: string;
  createdAt: any;
}

const DEFAULT_CATEGORIES: Omit<Category, "id" | "userId" | "createdAt">[] = [
  { name: "General", color: "#6366f1", icon: "📋" },
  { name: "Personal", color: "#8b5cf6", icon: "👤" },
  { name: "Sewa-Related", color: "#f59e0b", icon: "🙏" },
];

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "categories"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const categoriesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category));
      
      // If no categories exist, create defaults
      if (categoriesData.length === 0) {
        const defaultPromises = DEFAULT_CATEGORIES.map((cat) =>
          addDoc(collection(db, "categories"), {
            ...cat,
            userId: user.uid,
            createdAt: new Date(),
          })
        );
        await Promise.all(defaultPromises);
      } else {
        setCategories(categoriesData);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const addCategory = async (name: string, color: string, icon?: string) => {
    if (!user) return;
    await addDoc(collection(db, "categories"), {
      name,
      color,
      icon,
      userId: user.uid,
      createdAt: new Date(),
    });
  };

  const updateCategory = async (id: string, name: string, color: string, icon?: string) => {
    await updateDoc(doc(db, "categories", id), {
      name,
      color,
      icon,
    });
  };

  const deleteCategory = async (id: string) => {
    await deleteDoc(doc(db, "categories", id));
  };

  return {
    categories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
