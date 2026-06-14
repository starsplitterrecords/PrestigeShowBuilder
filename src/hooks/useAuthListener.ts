import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import type { User } from '../StoreContext';

export function useAuthListener(
  onAuthChange: (user: User | null) => void
) {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, firebaseUser => {
      const user: User | null = firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      } : null;
      onAuthChange(user);
    });
    return () => unsub();
  }, []);
}
