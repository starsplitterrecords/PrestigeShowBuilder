/**
 * Public type surface. All types are defined in focused
 * submodules and re-exported here for backward compatibility
 * with the 91 callers that import from '../types/models'.
 *
 * D294 (F5C pass 1) moved type definitions out of this file.
 * The submodules organize types by concern; this barrel
 * preserves the public surface.
 */

export * from './primitives';
export * from './character';
export * from './show';
export * from './beat';
export * from './comic';
export * from './reference';
export * from './generation';
