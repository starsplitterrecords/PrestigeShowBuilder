import { openDB } from '../storage/db';
import { VpsRun, VpsRecord, VpsRecordType, VpsPhase } from './types';
import { generateUlid } from '../psb4/console';
import { UID } from '../types/production';

export async function createVpsRun(showId: string, issueUid: UID): Promise<VpsRun> {
  const dbLocal = await openDB();
  const run: VpsRun = {
    id: generateUlid(),
    showId,
    issueUid,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    currentPhase: null,
    currentPass: null,
    phaseProgress: {
      environment: 'pending',
      page_direction: 'pending',
    },
    schemaVersion: 1,
  };

  return new Promise<VpsRun>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_runs', 'readwrite');
    const store = tx.objectStore('vps_runs');
    const req = store.add(run);
    req.onsuccess = () => resolve(run);
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveVpsRun(showId: string, issueUid: UID): Promise<VpsRun | null> {
  const dbLocal = await openDB();
  return new Promise<VpsRun | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_runs', 'readonly');
    const store = tx.objectStore('vps_runs');
    const index = store.index('by-issue');
    const req = index.getAll(issueUid);
    req.onsuccess = () => {
      const runs = req.result as VpsRun[];
      const active = runs.find(r => r.showId === showId && r.status === 'active');
      resolve(active || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateVpsRunPhase(runId: string, patch: Partial<VpsRun>): Promise<void> {
  const dbLocal = await openDB();
  const run = await new Promise<VpsRun | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_runs', 'readonly');
    const store = tx.objectStore('vps_runs');
    const req = store.get(runId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!run) {
    throw new Error(`VPS Run ${runId} not found`);
  }

  const updatedRun: VpsRun = {
    ...run,
    ...patch,
    updatedAt: Date.now(),
    phaseProgress: {
      ...run.phaseProgress,
      ...(patch.phaseProgress || {}),
    },
  };

  if (updatedRun.status === 'completed' && !updatedRun.completedAt) {
    updatedRun.completedAt = Date.now();
  }

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_runs', 'readwrite');
    const store = tx.objectStore('vps_runs');
    const req = store.put(updatedRun);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface VpsRecordInput {
  runId: string;
  showId: string;
  issueUid: UID;
  recordType: VpsRecordType;
  scopeKey: string | null;
  payload: any;
  payloadVersion: number;
  createdByPass: string;
  consoleEntryId: string | null;
}

export async function writeVpsRecord(input: VpsRecordInput): Promise<VpsRecord> {
  const dbLocal = await openDB();
  const prior = await getVpsRecord(input.runId, input.recordType, input.scopeKey);

  const record: VpsRecord = {
    id: generateUlid(),
    runId: input.runId,
    showId: input.showId,
    issueUid: input.issueUid,
    recordType: input.recordType,
    scopeKey: input.scopeKey,
    payload: input.payload,
    payloadVersion: input.payloadVersion,
    createdAt: Date.now(),
    createdByPass: input.createdByPass,
    consoleEntryId: input.consoleEntryId,
    authorEdited: false,
    authorEditedAt: null,
    applied: false,
    appliedAt: null,
    supersedesRecordId: prior ? prior.id : null,
    stale: false,
    staleReason: null,
    schemaVersion: 1,
  };

  return new Promise<VpsRecord>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readwrite');
    const store = tx.objectStore('vps_records');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getVpsRecord(
  runId: string,
  recordType: VpsRecordType,
  scopeKey: string | null
): Promise<VpsRecord | null> {
  const dbLocal = await openDB();
  return new Promise<VpsRecord | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readonly');
    const store = tx.objectStore('vps_records');
    const index = store.index('by-run-type');
    const req = index.getAll([runId, recordType]);
    req.onsuccess = () => {
      const records = req.result as VpsRecord[];
      const found = records.find(r => r.scopeKey === scopeKey);
      resolve(found || null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getVpsRecordsByRun(runId: string): Promise<VpsRecord[]> {
  const dbLocal = await openDB();
  return new Promise<VpsRecord[]>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readonly');
    const store = tx.objectStore('vps_records');
    const index = store.index('by-run');
    const req = index.getAll(runId);
    req.onsuccess = () => resolve(req.result as VpsRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function markVpsRecordEdited(recordId: string, newPayload: any): Promise<VpsRecord> {
  const dbLocal = await openDB();

  const record = await new Promise<VpsRecord | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readonly');
    const store = tx.objectStore('vps_records');
    const req = store.get(recordId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!record) {
    throw new Error(`VPS Record ${recordId} not found`);
  }

  const updated: VpsRecord = {
    ...record,
    payload: newPayload,
    authorEdited: true,
    authorEditedAt: Date.now(),
  };

  return new Promise<VpsRecord>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readwrite');
    const store = tx.objectStore('vps_records');
    const req = store.put(updated);
    req.onsuccess = () => resolve(updated);
    req.onerror = () => reject(req.error);
  });
}

export async function markVpsRecordApplied(recordId: string): Promise<void> {
  const dbLocal = await openDB();

  const record = await new Promise<VpsRecord | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readonly');
    const store = tx.objectStore('vps_records');
    const req = store.get(recordId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!record) {
    throw new Error(`VPS Record ${recordId} not found`);
  }

  const updated: VpsRecord = {
    ...record,
    applied: true,
    appliedAt: Date.now(),
  };

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readwrite');
    const store = tx.objectStore('vps_records');
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function markVpsRecordsStale(
  runId: string, pageUids: string[], reason: string
): Promise<void> {
  const dbLocal = await openDB();
  const recs = await getVpsRecordsByRun(runId);
  const set = new Set(pageUids);
  
  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_records', 'readwrite');
    const store = tx.objectStore('vps_records');
    
    let pending = 0;
    let hasError = false;
    
    const checkDone = () => {
      if (pending === 0 && !hasError) {
        resolve();
      }
    };

    for (const r of recs) {
      if (r.scopeKey && set.has(r.scopeKey) && !r.stale) {
        pending++;
        const updated = { ...r, stale: true, staleReason: reason };
        const req = store.put(updated);
        req.onsuccess = () => {
          pending--;
          checkDone();
        };
        req.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(req.error);
          }
        };
      }
    }
    
    if (pending === 0) {
      resolve();
    }
  });
}

export async function getStaleRecords(
  runId: string
): Promise<VpsRecord[]> {
  const recs = await getVpsRecordsByRun(runId);
  return recs.filter(r => r.stale);
}
