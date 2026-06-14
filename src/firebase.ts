import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration dynamically read from the provisioned applet parameters
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Core Firebase Application Initialization.
 * Binds the client SDK with the designated Google Cloud project credentials.
 */
const app = initializeApp(firebaseConfig);

/**
 * Firestore Database Instance.
 * Target database is dynamically configured, defaulting to either the standard root Firestore
 * or a secondary dedicated multi-tenant database instance defined during the set_up_firebase flow.
 */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Firebase Auth Instance.
 * Manages active sessions and coordinates user profile mappings.
 */
export const auth = getAuth(app);
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

// Force persistent browser context persistence so that authenticated states survive page reloads and tab close actions
setPersistence(auth, browserLocalPersistence).catch(err => console.warn("Auth persistence failed:", err));

/**
 * Firebase Cloud Storage Instance.
 * Handles unstructured binary assets (e.g. character concepts, comic layout images, and scene drafts).
 */
export const storage = getStorage(app);

// Google Identity Auth Helpers
export const googleProvider = new GoogleAuthProvider();

/**
 * Triggers interactive Google Single Sign-on authentications within a popup/modal container.
 * 
 * @returns {Promise<User>} Resolves with the credentialed User container on success
 * @throws {Error} Propagates initialization or workspace permission errors
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

/**
 * Destroys the current user session on the client, wiping local security states and cookies.
 * 
 * @returns {Promise<void>} Resolves when the user is successfully logged out
 */
export const signOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export { onAuthStateChanged };
export type { User };
