import { SummaryStorage } from './SummaryStorage';
import { ShowStorage } from './ShowStorage';
import { VaultIO } from './VaultIO';
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
  // Summaries
  getSummaries: SummaryStorage.getSummaries.bind(SummaryStorage),
  backfillSummaries: SummaryStorage.backfillSummaries.bind(SummaryStorage),

  // Show CRUD
  getAll: ShowStorage.getAll.bind(ShowStorage),
  getById: ShowStorage.getById.bind(ShowStorage),
  saveOne: ShowStorage.saveOne.bind(ShowStorage),
  deleteOne: ShowStorage.deleteOne.bind(ShowStorage),

  // Vault I/O
  exportVault: VaultIO.exportVault.bind(VaultIO),
  exportShow: VaultIO.exportShow.bind(VaultIO),
  importVault: VaultIO.importVault.bind(VaultIO),
  auditStorage: VaultIO.auditStorage.bind(VaultIO),

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
