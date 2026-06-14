import { SummaryStorage } from './SummaryStorage';
import { ShowStorage } from './ShowStorage';
import { VaultIO } from './VaultIO';
import { SyncOrchestrator } from './SyncOrchestrator';
import { runPromotionCleanup } from './cleanupDuplicatePromotions';
import {
  writePromotion,
  writeImageVersion,
  updateProductionPage,
  updateIssueManifest,
  getImageVersionsForPage,
  getImageVersionsForShow,
  updateImageVersionStatus,
  deleteImageVersionsForPage,
  deleteUnapprovedVersionsForPage,
  getIssueManifest,
  getProductionPagesForIssue
} from './ProductionStorage';

/**
 * VaultStorage facade. Re-exports public surface from
 * five focused modules. F5A complete after D285.
 */
export {
  writePromotion,
  writeImageVersion,
  updateProductionPage,
  updateIssueManifest,
  getImageVersionsForPage,
  getImageVersionsForShow,
  updateImageVersionStatus,
  deleteImageVersionsForPage,
  deleteUnapprovedVersionsForPage,
  getIssueManifest,
  getProductionPagesForIssue
} from './ProductionStorage';
export { runPromotionCleanup } from './cleanupDuplicatePromotions';

export const VaultStorage = {
  // Summaries (D282)
  getSummaries: SummaryStorage.getSummaries.bind(SummaryStorage),
  getCloudSummaries: SummaryStorage.getCloudSummaries.bind(SummaryStorage),
  rehydrateSummariesFromCloud: SummaryStorage.rehydrateSummariesFromCloud.bind(SummaryStorage),
  getCloudSummaryStatus: SummaryStorage.getCloudSummaryStatus.bind(SummaryStorage),
  setLocalSyncMeta: SummaryStorage.setLocalSyncMeta.bind(SummaryStorage),
  getLocalSyncMeta: SummaryStorage.getLocalSyncMeta.bind(SummaryStorage),
  getAllSyncMeta: SummaryStorage.getAllSyncMeta.bind(SummaryStorage),
  backfillSummaries: SummaryStorage.backfillSummaries.bind(SummaryStorage),

  // Show CRUD (D283)
  getAll: ShowStorage.getAll.bind(ShowStorage),
  getById: ShowStorage.getById.bind(ShowStorage),
  pullFromCloud: ShowStorage.pullFromCloud.bind(ShowStorage),
  saveOne: ShowStorage.saveOne.bind(ShowStorage),
  deleteOne: ShowStorage.deleteOne.bind(ShowStorage),

  // Vault I/O (D284)
  exportVault: VaultIO.exportVault.bind(VaultIO),
  exportShow: VaultIO.exportShow.bind(VaultIO),
  importVault: VaultIO.importVault.bind(VaultIO),
  auditStorage: VaultIO.auditStorage.bind(VaultIO),

  // Sync orchestration (D285)
  getSyncStatus: SyncOrchestrator.getSyncStatus.bind(SyncOrchestrator),
  syncLocalToCloud: SyncOrchestrator.syncLocalToCloud.bind(SyncOrchestrator),

  // New production model write helpers (DA-002)
  writePromotion,
  writeImageVersion,
  updateProductionPage,
  updateIssueManifest,
  getImageVersionsForPage,
  getImageVersionsForShow,
  updateImageVersionStatus,
  deleteImageVersionsForPage,
  deleteUnapprovedVersionsForPage,
  getIssueManifest,
  getProductionPagesForIssue,
  runPromotionCleanup,
};
