export type Psb4ErrorCode = 
  | 'DUPLICATE_ACTIVE_RUN' 
  | 'ARTIFACT_EXISTS' 
  | 'CANNOT_OVERWRITE_AUTHOR_EDIT' 
  | 'INVALID_STATUS_TRANSITION'
  | 'RUN_NOT_FOUND'
  | 'HASH_MISMATCH';

export class Psb4InvariantError extends Error {
  code: Psb4ErrorCode;

  constructor(code: Psb4ErrorCode, message: string) {
    super(message);
    this.name = 'Psb4InvariantError';
    this.code = code;
    
    // Set prototype explicitly for proper inheritance in ES5/ES6
    Object.setPrototypeOf(this, Psb4InvariantError.prototype);
  }
}
