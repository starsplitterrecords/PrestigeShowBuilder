import { ShowRegister } from '../types/primitives';

export function envRegisterGuidance(r?: ShowRegister): string {
  switch (r) {
    case 'comedy': return 'Register: deadpan comedy. Environments are ' +
      'mundane, over-ordinary, and a little too tidy or too bleak. The ' +
      'humour is in the flat normalcy of the place, not in whimsy. Keep ' +
      'descriptions plain and specific; avoid dramatic atmosphere.';
    case 'drama': return 'Register: war drama. Environments carry weight, ' +
      'history, and damage. Surfaces are worn, lit hard and directional. ' +
      'The place has been used and suffered in. Emphasise materials, ' +
      'scale, and the marks of what happened here.';
    case 'mixed': return 'Register: mixed. Let each setting take its tone ' +
      'from how it is used dramatically rather than a single house style.';
    default: return '';
  }
}

export function pageRegisterGuidance(r?: ShowRegister): string {
  switch (r) {
    case 'comedy': return 'Register: deadpan comedy. Stage flat and still. ' +
      'Characters hold position; the comedy is in visual restraint and the ' +
      'gap between a composed frame and absurd content. Favour symmetry, ' +
      'frontal stillness, and held wide shots. Avoid dynamic action ' +
      'staging, motion lines, and theatrical camera angles. Reaction is ' +
      'understatement, not mugging.';
    case 'drama': return 'Register: war drama. Bodies occupy space heavily ' +
      'and carry exhaustion. The camera respects distance and silence; ' +
      'negative space is allowed to sit. Light is hard and directional. ' +
      'Let stillness and the unsaid do the work; avoid busy or decorative ' +
      'staging.';
    case 'mixed': return 'Register: mixed. Let each visual approach for ' +
      'each page from its emotional register rather than one house style.';
    default: return '';
  }
}
