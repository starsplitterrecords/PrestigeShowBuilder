import { safeStringify } from '../utils/safeJson';
import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = 
    errMessage.includes('quota') || 
    errMessage.includes('Quota') || 
    errMessage.includes('resource-exhausted') || 
    errMessage.includes('RESOURCE_EXHAUSTED') || 
    errMessage.includes('exhausted') ||
    errMessage.includes('PERMISSION_DENIED') ||
    errMessage.includes('permission_denied') ||
    errMessage.includes('Permission denied');

  if (isQuotaError && typeof window !== 'undefined') {
    (window as any).__firestore_write_quota_exhausted__ = true;
    window.dispatchEvent(new Event('psb4_firestore_quota_exhausted_changed'));
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  const jsonString = safeStringify(errInfo);
  // Log only. Never throw.
  // Firebase failures must not propagate into local operations.
  console.warn("[Firebase] Non-fatal error:", jsonString);
}
