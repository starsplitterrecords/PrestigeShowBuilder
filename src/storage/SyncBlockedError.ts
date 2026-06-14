import { SyncStatus } from "../types/models";

export class SyncBlockedError extends Error {
  status?: SyncStatus;
  reason: 'auth' | 'uid-mismatch' | 'cloud-newer' | 'unknown';

  constructor(
    message: string,
    reason: SyncBlockedError['reason'] = 'unknown',
    status?: SyncStatus,
  ) {
    super(message);
    this.name = "SyncBlockedError";
    this.reason = reason;
    this.status = status;

    // Preserve prototype chain across transpilation
    Object.setPrototypeOf(this, SyncBlockedError.prototype);
  }
}
