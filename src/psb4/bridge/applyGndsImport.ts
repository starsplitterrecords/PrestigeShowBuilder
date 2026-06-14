import { Show, Season, Episode, Act, Scene } from '../../types/show';
import { CinematicBeat, BeatScript } from '../../types/beat';
import { Psb4Artifact, SceneStructurePayload } from '../types';
import { resolveCharacter } from '../../domainUtils';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function applyGndsImport(show: Show, artifact: Psb4Artifact): Season[] {
  if (!artifact.episodeId) {
    throw new Error('Artifact has no associated episodeId');
  }
  const payload = artifact.payload as SceneStructurePayload;
  if (!payload || !Array.isArray(payload.acts)) {
    throw new Error('Invalid Scene Structure payload');
  }

  const seasons = show.seasons ?? [];
  return seasons.map(season => {
    const hasEpisode = season.episodes.some(ep => ep.id === artifact.episodeId || ep.fid === artifact.episodeId);
    if (!hasEpisode) return season;

    const episodes = season.episodes.map(episode => {
      if (episode.id !== artifact.episodeId && episode.fid !== artifact.episodeId) {
        return episode;
      }

      // Map Acts from the payload
      const acts: Act[] = payload.acts.map(pAct => {
        const existingAct = episode.acts?.find(a => a.number === pAct.actNumber);
        const actId = existingAct?.id || generateId();
        const actFid = existingAct?.fid || `A${pAct.actNumber}-${generateId().substring(0, 4)}`;

        // Map Scenes inside the Act
        const scenes: Scene[] = pAct.scenes.map(pScene => {
          const existingScene = existingAct?.scenes?.find(s => s.number === pScene.sceneNumber);
          const sceneId = existingScene?.id || generateId();
          const sceneFid = existingScene?.fid || `S${pScene.sceneNumber}-${generateId().substring(0, 4)}`;

          // Map Beats inside the Scene
          const cinematicBeats: CinematicBeat[] = pScene.beats.map((pBeat, bIdx) => {
            const existingBeat = existingScene?.cinematicBeats?.[bIdx];
            const beatId = existingBeat?.id || generateId();
            const beatFid = existingBeat?.fid || `B${bIdx + 1}-${generateId().substring(0, 4)}`;

            const hasScript = Array.isArray(pBeat.script) && pBeat.script.length > 0;
            
            // Build script object
            const script: BeatScript = {
              gndsSourceId: `${artifact.id}-${bIdx}`,
              aiGenerated: true,
              entries: hasScript ? pBeat.script!.map((e, sIdx) => {
                const entryFid = `${beatFid}-SE${sIdx}`;
                if (e.kind === 'caption') {
                  const styleVal = (e.captionStyle === 'yellow' || e.captionStyle === 'white' || e.captionStyle === 'grey' || e.captionStyle === 'none' || e.captionStyle === 'character')
                    ? e.captionStyle
                    : 'grey';
                  return {
                    kind: 'caption' as const,
                    fid: entryFid,
                    text: e.text || '',
                    style: styleVal,
                    characterHandle: e.characterHandle,
                  };
                } else {
                  return {
                    fid: entryFid,
                    characterHandle: e.characterHandle || 'UNKNOWN',
                    text: e.text || '',
                    parenthetical: e.parenthetical || undefined,
                    isDone: false,
                  };
                }
              }) : [],
              lines: [] // Deprecated
            };

            const charNames = (pBeat.characterHandles || [])
              .map(h => {
                const char = resolveCharacter(show, h);
                return char ? char.name : null;
              })
              .filter((n): n is string => Boolean(n));

            const groundingEnsemble = charNames.length > 0 ? charNames.join(', ') : undefined;

            const beatResult: CinematicBeat = {
              ...(existingBeat || {}),
              id: beatId,
              fid: beatFid,
              description: pBeat.description || '',
              beatType: pBeat.beatType || 'DIALOGUE',
              subtext: pBeat.subtext || '',
              visualDescription: pBeat.visualNote || '',
              direction: pBeat.direction || '',
              characterIds: (pBeat.characterHandles || []).map(ref => {
                const char = resolveCharacter(show, ref);
                return char ? char.id : ref;
              }),
              groundingEnsemble,
              gndsSource: pBeat.source || 'new',
              gndsArchived: false,
              scriptStale: !hasScript,
              letteringStale: true,
              panelPlanStale: true,
              visualsStale: true,
              beatPageStale: true,
              script: hasScript ? script : undefined,
            };

            return beatResult;
          });

          return {
            id: sceneId,
            fid: sceneFid,
            number: pScene.sceneNumber,
            title: pScene.title || `Scene ${pScene.sceneNumber}`,
            summary: pScene.function || '',
            setting: pScene.setting || '',
            dramaticWant: pScene.dramaticWant || '',
            contentStale: false,
            gndsArchived: false,
            cinematicBeats,
          };
        });

        return {
          id: actId,
          fid: actFid,
          number: pAct.actNumber,
          summary: pAct.title || `Act ${pAct.actNumber}`,
          contentStale: false,
          gndsArchived: false,
          scenes,
        };
      });

      return {
        ...episode,
        acts
      };
    });

    return {
      ...season,
      episodes
    };
  });
}
