// src/domainUtils.ts
// Barrel re-export. All functions remain importable from this path.
// 54 existing consumers need no changes.

export * from './utils/scriptUtils';
export * from './utils/characterUtils';
export * from './utils/fidUtils';
export * from './utils/staleUtils';
export * from './utils/locationUtils';
export * from './utils/showUtils';
export * from './utils/productionStatus';

// Functions kept here — not worth their own module yet.
export function generateUID(): string {
  return crypto.randomUUID();
}

export function buildProductionAddress(
  showCode: string, seasonNum: number,
  issueNum: number, actNum: number,
  sceneNum: number, pbNum: number
): string {
  return [showCode, `S${seasonNum}`,
    `I${String(issueNum).padStart(2,'0')}`,
    `A${actNum}`,
    `SC${String(sceneNum).padStart(2,'0')}`,
    `PB${String(pbNum).padStart(2,'0')}`
  ].join('-');
}

export { getApiKey, appendGenerationLog, appendTextGenerationLog } from './apiUtils';
