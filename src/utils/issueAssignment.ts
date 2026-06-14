import { ComicGalleryEntry, IssuePageAssignment } from '../types/comic';

/**
 * Syncs the legacy comicGallery entries to match the new IssuePageAssignments list.
 * This guarantees both data stores stay perfectly inline.
 */
export function applyComicGalleryAssignmentSync(
  gallery: ComicGalleryEntry[],
  assignments: IssuePageAssignment[]
): ComicGalleryEntry[] {
  return gallery.map(e => {
    if (e.status === 'archived') return e;
    const assignment = assignments.find(a => a.beatFid === e.beatFid);
    if (assignment) {
      return {
        ...e,
        issueId: assignment.issueId,
        pageNumber: assignment.pageNumber,
        isCover: !!assignment.isCover
      };
    } else {
      return {
        ...e,
        issueId: undefined,
        pageNumber: undefined,
        isCover: false
      };
    }
  });
}

/**
 * Syncs assignments when a new gallery entry is created or its status changes.
 */
export function syncAssignmentFromGalleryEntry(
  assignments: IssuePageAssignment[],
  entry: ComicGalleryEntry,
  showId: string
): IssuePageAssignment[] {
  if (!entry.issueId || entry.pageNumber === undefined || entry.status === 'archived') {
    return assignments;
  }
  const existingIdx = assignments.findIndex(a => a.beatFid === entry.beatFid);
  const status: 'planned' | 'generated' | 'approved' | 'lettered' | 'exported' = 
    entry.status === 'approved' ? 'approved' : 'generated';

  if (existingIdx >= 0) {
    const updated = [...assignments];
    updated[existingIdx] = {
      ...updated[existingIdx],
      issueId: entry.issueId,
      pageNumber: entry.pageNumber,
      isCover: !!entry.isCover,
      assetId: entry.assetId,
      galleryEntryId: entry.assetId,
      status,
      updatedAt: Date.now()
    };
    return updated;
  } else {
    return [
      ...assignments,
      {
        id: `${entry.issueId}_${entry.pageNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        showId,
        issueId: entry.issueId,
        pageNumber: entry.pageNumber,
        isCover: !!entry.isCover,
        beatFid: entry.beatFid,
        assetId: entry.assetId,
        galleryEntryId: entry.assetId,
        status,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  }
}

/**
 * Lists issue IDs from both assignments and gallery entries.
 */
export function listIssueIdsFromAssignments(
  assignments: IssuePageAssignment[] | undefined,
  gallery: ComicGalleryEntry[] | undefined
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];

  if (assignments) {
    for (const a of assignments) {
      if (!a.issueId) continue;
      if (seen.has(a.issueId)) continue;
      seen.add(a.issueId);
      order.push(a.issueId);
    }
  }

  if (gallery) {
    for (const e of gallery) {
      if (e.status === 'archived') continue;
      if (!e.issueId) continue;
      if (seen.has(e.issueId)) continue;
      seen.add(e.issueId);
      order.push(e.issueId);
    }
  }

  return order;
}

/**
 * Main assignment router for Planned + Generated workflow
 */
export function applyIssuePageAssignment(args: {
  assignments: IssuePageAssignment[];
  beatFid: string;
  showId: string;
  issueId: string;
  issueTitle?: string;
  pageNumber: number;
  isCover?: boolean;
  assetId?: string;
  galleryEntryId?: string;
  status?: 'planned' | 'generated' | 'approved' | 'lettered' | 'exported';
}): IssuePageAssignment[] {
  const { assignments, beatFid, showId, issueId, issueTitle, pageNumber, isCover, assetId, galleryEntryId, status = 'planned' } = args;

  let updatedList = [...assignments];

  // 1. Resolve conflict / push-down logic for all OTHER assignments in the SAME issue with pageNumber >= the new pageNumber
  updatedList = updatedList.map(a => {
    if (a.beatFid === beatFid) {
      return a;
    }
    if (
      a.issueId === issueId &&
      typeof a.pageNumber === 'number' &&
      a.pageNumber >= pageNumber
    ) {
      return { ...a, pageNumber: a.pageNumber + 1, updatedAt: Date.now() };
    }
    return a;
  });

  // 2. Clear any old assignment covers if we are setting this one as cover
  if (isCover) {
    updatedList = updatedList.map(a => {
      if (a.issueId === issueId && a.isCover && a.beatFid !== beatFid) {
        return { ...a, isCover: false, updatedAt: Date.now() };
      }
      return a;
    });
  }

  // 3. Update or create the assignment for this beatFid
  const existingIdx = updatedList.findIndex(a => a.beatFid === beatFid);
  const resolvedStatus = status || (assetId ? 'generated' : 'planned');
  
  if (existingIdx >= 0) {
    const prev = updatedList[existingIdx];
    updatedList[existingIdx] = {
      ...prev,
      issueId,
      issueTitle: issueTitle || prev.issueTitle,
      pageNumber,
      isCover: !!isCover,
      assetId: assetId !== undefined ? assetId : prev.assetId,
      galleryEntryId: galleryEntryId !== undefined ? galleryEntryId : prev.galleryEntryId,
      status: prev.status === 'planned' && assetId ? 'generated' : resolvedStatus,
      updatedAt: Date.now()
    };
  } else {
    updatedList.push({
      id: `${issueId}_${pageNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      showId,
      issueId,
      issueTitle,
      pageNumber,
      isCover: !!isCover,
      beatFid,
      assetId,
      galleryEntryId,
      status: resolvedStatus,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  return updatedList;
}

/**
 * Returns the next available page number for an issue (Planned + Generated).
 */
export function nextPageNumberForIssue(
  items: Array<{ issueId?: string; pageNumber?: number; status?: string }>,
  issueId: string
): number {
  if (!issueId || !items) return 1;
  const inIssue = items
    .filter(a => a.issueId === issueId && a.status !== 'archived')
    .map(a => a.pageNumber || 0);
    
  if (inIssue.length === 0) return 1;
  return Math.max(...inIssue) + 1;
}

/**
 * Bi-directional synchronizer to maintain perfect alignment of IssuePageAssignment and ComicGalleryEntry.
 */
export function syncShowAssignmentsAndGallery(
  showId: string,
  assignments: IssuePageAssignment[] | undefined,
  gallery: ComicGalleryEntry[] | undefined
): { assignments: IssuePageAssignment[]; gallery: ComicGalleryEntry[] } {
  const currentAssignments: IssuePageAssignment[] = assignments ? [...assignments] : [];
  const currentGallery: ComicGalleryEntry[] = gallery ? [...gallery] : [];

  // Map of beatFid -> assignment for fast lookups
  const assignmentMap = new Map<string, IssuePageAssignment>();
  currentAssignments.forEach(a => {
    if (a.beatFid) {
      assignmentMap.set(a.beatFid, a);
    }
  });

  // 1. Sync from gallery entries to planned assignments
  currentGallery.forEach(entry => {
    if (entry.status === 'archived' || !entry.beatFid) return;
    
    const existing = assignmentMap.get(entry.beatFid);
    
    // Determine status from the gallery entry
    let derivedStatus: 'planned' | 'generated' | 'approved' | 'lettered' | 'exported' = 'generated';
    if (entry.status === 'approved') {
      derivedStatus = 'approved';
    } else if (entry.variantType === 'lettered') {
      derivedStatus = 'lettered';
    }

    if (existing) {
      // Update existing page metadata
      existing.assetId = entry.assetId;
      existing.galleryEntryId = entry.assetId;
      
      // Upgrade status from planned if applicable
      if (existing.status === 'planned') {
        existing.status = derivedStatus;
      }
      
      // Align assignment details
      if (entry.issueId && entry.pageNumber !== undefined) {
        existing.issueId = entry.issueId;
        existing.pageNumber = entry.pageNumber;
        existing.isCover = !!entry.isCover;
      }
    } else if (entry.issueId && entry.pageNumber !== undefined) {
      // Create new assignment inline
      const newAssignment: IssuePageAssignment = {
        id: `${entry.issueId}_${entry.pageNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        showId: showId,
        issueId: entry.issueId,
        pageNumber: entry.pageNumber,
        isCover: !!entry.isCover,
        beatFid: entry.beatFid,
        galleryEntryId: entry.assetId,
        assetId: entry.assetId,
        status: derivedStatus,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      currentAssignments.push(newAssignment);
      assignmentMap.set(entry.beatFid, newAssignment);
    }
  });

  // 2. Sync assignment information back onto corresponding gallery entries
  const updatedGallery = currentGallery.map(entry => {
    if (entry.status === 'archived' || !entry.beatFid) return entry;
    
    const assignment = assignmentMap.get(entry.beatFid);
    if (assignment) {
      return {
        ...entry,
        issueId: assignment.issueId,
        pageNumber: assignment.pageNumber,
        isCover: !!assignment.isCover
      };
    }
    return entry;
  });

  return {
    assignments: currentAssignments,
    gallery: updatedGallery
  };
}

/**
 * D303: Apply issue/page assignment to a gallery entry with push-down
 * conflict resolution.
 * 
 * Rule: when assigning entry E to (issueId, pageNumber), all OTHER
 * non-archived entries in the same issue with pageNumber >= the new
 * pageNumber get their pageNumber incremented by 1. E's previous
 * pageNumber slot, if any, is left as a gap (not auto-filled).
 */
export function applyIssueAssignment(args: {
  gallery: ComicGalleryEntry[];
  targetAssetId: string;
  issueId: string;
  pageNumber: number;
}): ComicGalleryEntry[] {
  const { gallery, targetAssetId, issueId, pageNumber } = args;
  
  // Sort gallery to ensure push-down happens consistently if multiple entries are affected
  // though map handles it fine since we just check >= pageNumber.
  
  return gallery.map(e => {
    if (e.assetId === targetAssetId) {
      // The target gets its new assignment.
      return { ...e, issueId, pageNumber };
    }
    if (
      e.status !== 'archived' &&
      e.issueId === issueId &&
      typeof e.pageNumber === 'number' &&
      e.pageNumber >= pageNumber
    ) {
      // Push-down on collision.
      return { ...e, pageNumber: e.pageNumber + 1 };
    }
    return e;
  });
}



/**
 * Returns the set of issueIds in use, sorted by first appearance order.
 */
export function listIssueIds(gallery: ComicGalleryEntry[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const e of gallery) {
    if (e.status === 'archived') continue;
    if (!e.issueId) continue;
    if (seen.has(e.issueId)) continue;
    seen.add(e.issueId);
    order.push(e.issueId);
  }
  return order;
}

/**
 * Detects if there are gaps in page numbering for an issue.
 */
export function detectGap(pages: ComicGalleryEntry[]): boolean {
  if (pages.length === 0) return false;
  const numbers = pages
    .map(p => p.pageNumber || 0)
    .filter(n => n > 0)
    .sort((a, b) => a - b);
    
  if (numbers.length === 0) return false;
  if (numbers[0] !== 1) return true;
  
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i + 1] !== numbers[i] + 1) return true;
  }
  
  return false;
}

/**
 * D306: Apply cover assignment to a gallery entry.
 * 
 * Rule: the target entry becomes the cover for issueId (isCover=true,
 * pageNumber cleared). Any existing cover for that issue is unassigned —
 * its issueId is cleared, isCover set to false. The previous cover
 * returns to Unassigned, where the user can re-commit it elsewhere.
 */
export function applyCoverAssignment(args: {
  gallery: ComicGalleryEntry[];
  targetAssetId: string;
  issueId: string;
}): ComicGalleryEntry[] {
  const { gallery, targetAssetId, issueId } = args;

  return gallery.map(e => {
    if (e.assetId === targetAssetId) {
      // Target becomes the cover
      return {
        ...e,
        issueId,
        isCover: true,
        pageNumber: undefined,
      };
    }
    if (
      e.status !== 'archived' &&
      e.issueId === issueId &&
      e.isCover
    ) {
      // Old cover for the same issue: unassign
      return {
        ...e,
        issueId: undefined,
        isCover: false,
      };
    }
    return e;
  });
}

/**
 * Returns the entry currently assigned as cover for issueId, or undefined.
 */
export function getIssueCover(
  gallery: ComicGalleryEntry[],
  issueId: string
): ComicGalleryEntry | undefined {
  return gallery.find(e =>
    e.status !== 'archived' &&
    e.issueId === issueId &&
    e.isCover === true
  );
}

/**
 * Returns true if the entry is a cover-flavored gallery entry.
 */
export function isCoverEntry(entry: ComicGalleryEntry): boolean {
  return entry.beatFid?.toLowerCase().endsWith('cover') === true
    || entry.generationMethod === 'cover-pass1';
}
