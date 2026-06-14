import React from 'react';
import { Psb4Artifact, SceneStructurePayload, SceneStructureBeat, SceneScriptEntry } from '../types';
import { Layers, MapPin, Eye, Film, AlertTriangle } from 'lucide-react';

export const SceneStructureView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as SceneStructurePayload;
  if (!payload || !Array.isArray(payload.acts)) {
    return <div className="p-4 text-xs font-mono text-red-400">Invalid or empty Scene Structure payload.</div>;
  }

  return (
    <div className="h-full flex flex-col text-left" id="scene_structure_view_root">
      <div className="shrink-0 border-b border-white/10 pb-3 px-1 pt-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
          Scene Structure Extraction &amp; Script • {artifact.episodeId ? `Episode ${artifact.episodeId}` : 'Arc'}
        </span>
        <h2 className="text-lg font-bold text-white mt-1">
          GNDS Structured Spine
        </h2>
        <p className="text-xs text-white/60 mt-0.5">
          Acts, Scenes, and Beats produced via pass 0.9S / 0.9G.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 px-1 space-y-6">
        {payload.acts.map((act) => (
          <div key={`act-${act.actNumber}`} className="border-l-2 border-amber-500/30 pl-4 space-y-4">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-amber-400 shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Act {act.actNumber}: {act.title || 'Untitled Act'}
              </h3>
            </div>

            <div className="space-y-4">
              {(act.scenes || []).map((scene) => (
                <div key={`scene-${scene.sceneNumber}`} className="bg-[#0b0b0b] border border-white/10 rounded-sm p-3.5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 pb-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded-xs border border-amber-500/20">
                          Scene {scene.sceneNumber}
                        </span>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                          {scene.title || 'Untitled Scene'}
                        </h4>
                      </div>
                      <p className="text-xs text-white/80 font-sans leading-normal">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">Setting:</span>
                        {scene.setting || 'Not specified'}
                      </p>
                    </div>

                    <div className="text-right space-y-0.5 max-w-xs">
                      {scene.dramaticWant && (
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">Dramatic Want:</span>
                          <p className="text-[11px] text-white/85 italic leading-snug">{scene.dramaticWant}</p>
                        </div>
                      )}
                      {scene.function && (
                        <p className="text-[10px] text-white/60 leading-tight">
                          <span className="font-bold">Function:</span> {scene.function}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Beats list */}
                  <div className="space-y-2.5">
                    {(scene.beats || []).map((beat, bIdx) => {
                      const hasScript = Array.isArray(beat.script) && beat.script.length > 0;
                      return (
                        <div key={`beat-${bIdx}`} className="bg-[#121212] border border-white/5 rounded-xs p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-xs bg-white/10 text-white/90">
                                  {beat.beatType || 'DIALOGUE'}
                                </span>
                                {beat.source && (
                                  <span className="text-[9px] font-mono text-white/50 uppercase">
                                    Source: {beat.source} {beat.sourceBeatNumbers?.length > 0 && `(${beat.sourceBeatNumbers.join(', ')})`}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/90 leading-relaxed font-sans mt-1">
                                {beat.description}
                              </p>
                            </div>
                          </div>

                          {beat.subtext && (
                            <div className="text-[10px] text-white/60 bg-white/[0.02] px-2 py-1 rounded-xs border-l border-white/10 italic">
                              <span className="font-mono uppercase tracking-wider text-[9px] not-italic text-white/50 block">Subtext:</span>
                              {beat.subtext}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-white/60">
                            {beat.visualNote && (
                              <div>
                                <span className="font-mono uppercase tracking-widest text-[9px] text-white/50 block">Visual Note:</span>
                                <p className="leading-snug text-white/70">{beat.visualNote}</p>
                              </div>
                            )}
                            {beat.direction && (
                              <div>
                                <span className="font-mono uppercase tracking-widest text-[9px] text-white/50 block">Direction:</span>
                                <p className="leading-snug text-white/70">{beat.direction}</p>
                              </div>
                            )}
                          </div>

                          {/* Script Dialog Render */}
                          <div className="mt-2.5 pt-2 border-t border-white/5">
                            {!hasScript ? (
                              <div className="flex items-center gap-1 text-[10px] text-amber-500/80 bg-amber-950/20 border border-amber-500/10 px-2 py-1.5 rounded-xs">
                                <AlertTriangle size={11} className="shrink-0" />
                                <span>Dialogue pending (0.9G has not run yet or no dialogue is available for this beat).</span>
                              </div>
                            ) : (
                              <div className="space-y-2 pl-2 border-l border-amber-500/20">
                                <span className="text-[9px] font-mono uppercase tracking-widest text-amber-300 block mb-1">Dialogue / Captions:</span>
                                {(beat.script || []).map((entry, eIdx) => (
                                  <div key={`entry-${eIdx}`} className="text-xs leading-normal">
                                    {entry.kind === 'line' ? (
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                                          <span>{entry.characterHandle}</span>
                                          {entry.parenthetical && (
                                            <span className="text-white/50 text-[10px] lowercase italic normal-case font-sans">
                                              ({entry.parenthetical})
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-white/90 font-sans pl-1">{entry.text}</p>
                                      </div>
                                    ) : (
                                      <div className="bg-white/5 border border-white/10 rounded-xs p-1.5 max-w-md my-1">
                                        <div className="flex items-center gap-1.5 mb-0.5 text-[9px] font-mono uppercase font-black tracking-widest text-white/65">
                                          <span>Caption</span>
                                          {entry.captionStyle && (
                                            <span className="bg-white/10 text-white/80 px-1 py-0.5 rounded-sm text-[10px]">
                                              {entry.captionStyle}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-white/80 font-sans italic pl-0.5">{entry.text}</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
