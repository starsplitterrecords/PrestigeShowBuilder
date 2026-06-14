import { GenerationManifest } from "../contextResolver";

/**
* Manifest for generateDialogueScript per F25 §4.1.
*
* Notable absences:
* - contentGenerationStandard: false. Dialogue is speech;
*   the standard governs visual prose. Category mismatch.
* - themes/narrativeMechanism: not included. Premise card
*   carries enough show context for dialogue.
* - styleConfig: visual concern, not dialogue concern.
* - act/episode summary: redundant with beat + scene.
*/
export const dialogueScriptManifest: GenerationManifest = {
 generatorName: 'generateDialogueScript',
 layer1: {
   show: {
     title: true,
     premise: 'card',     // one line, ~100 chars
     register: true,
   },
   characters: 'cards-in-beat',  // only beat's characters,
                                 // and only their cards
 },
 layer2: {
   beat: 'description+subtext',  // physical situation +
                                 // what they actually mean
   sceneSetting: 'card',
   sceneWant: 'card',
   precedingDialogueInScene: true,  // ALL same-scene lines
 },
 layer3: {
   contentGenerationStandard: false,  // F25 §4.1
   instructions: 'dialogueScript',
   comedyGuidelinesIfComedy: true,
 },
};
