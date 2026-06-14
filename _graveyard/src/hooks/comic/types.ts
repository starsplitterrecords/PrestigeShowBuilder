import { CinematicBeat } from '../../types/models';

export type SelectableBeat = CinematicBeat & {
  _sIdx: number;
  _eIdx: number;
  _aIdx: number;
  _scIdx: number;
  _bIdx: number;
};

export type BatchScope = 'beat' | 'scene' | 'act' | 'episode' | 'scene-pages';
export type GenerationMethod = 'visual' | 'script' | 'both';

export type TargetBeat = {
  beat: CinematicBeat;
  sIdx: number;
  eIdx: number;
  aIdx: number;
  scIdx: number;
  bIdx: number;
};
