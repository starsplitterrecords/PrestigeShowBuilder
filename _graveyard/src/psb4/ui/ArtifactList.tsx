import React, { useState, useMemo } from 'react';
import { Psb4Artifact, ArtifactType } from '../types';
import { useStore } from '../../StoreContext';
import { LayoutGrid, Layers, User, HelpCircle, Eye } from 'lucide-react';

interface ArtifactListProps {
  artifacts: Psb4Artifact[];
  selectedArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
}

export const ArtifactList: React.FC<ArtifactListProps> = ({
  artifacts,
  selectedArtifactId,
  onSelectArtifact,
}) => {
  const { state } = useStore();
  const show = state.currentShow;

  // Local filter states
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [authorEditedOnly, setAuthorEditedOnly] = useState<boolean>(false);

  // Helper mappings
  const episodeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (show?.seasons) {
      for (const season of show.seasons) {
        if (season.episodes) {
          for (const ep of season.episodes) {
            map.set(ep.id, ep.title || `Episode ${ep.number}`);
          }
        }
      }
    }
    return map;
  }, [show]);

  const characterMap = useMemo(() => {
    const map = new Map<string, string>();
    if (show?.characters) {
      for (const char of show.characters) {
        map.set(char.id, char.name);
      }
    }
    return map;
  }, [show]);

  const getEpisodeTitle = (episodeId: string | null) => {
    if (!episodeId) return 'Global Context';
    return episodeMap.get(episodeId) || `Episode Source: ${episodeId}`;
  };

  const getCharacterName = (artifact: Psb4Artifact) => {
    // Attempt standard character mapping from payload or metadata
    const charId = artifact.payload?.characterId || artifact.payload?.id || null;
    if (charId && characterMap.has(charId)) {
      return characterMap.get(charId)!;
    }
    if (artifact.payload?.characterName) {
      return String(artifact.payload.characterName);
    }
    return 'General Characters';
  };

  const formatTypeLabel = (typeStr: string) => {
    return typeStr
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Extract unique filters dynamically
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    for (const art of artifacts) {
      types.add(art.artifactType);
    }
    return Array.from(types);
  }, [artifacts]);

  const uniqueScopes = useMemo(() => {
    const scopes = new Set<string>();
    for (const art of artifacts) {
      scopes.add(art.scope);
    }
    return Array.from(scopes);
  }, [artifacts]);

  // Apply filters
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((art) => {
      if (scopeFilter !== 'all' && art.scope !== scopeFilter) return false;
      if (typeFilter !== 'all' && art.artifactType !== typeFilter) return false;
      if (authorEditedOnly && !art.authorEdited) return false;
      return true;
    });
  }, [artifacts, scopeFilter, typeFilter, authorEditedOnly]);

  // Grouping structures
  const groupedData = useMemo(() => {
    // Top-level grouping: scope
    const groups: Record<string, any> = {
      arc: [],
      episode: {}, // subgrouped by episode title
      character: {}, // subgrouped by character name
      relationship: [],
      motif: [],
    };

    for (const art of filteredArtifacts) {
      const scope = art.scope;
      if (scope === 'episode') {
        const title = getEpisodeTitle(art.episodeId);
        if (!groups.episode[title]) groups.episode[title] = [];
        groups.episode[title].push(art);
      } else if (scope === 'character') {
        const name = getCharacterName(art);
        if (!groups.character[name]) groups.character[name] = [];
        groups.character[name].push(art);
      } else {
        if (!groups[scope]) groups[scope] = [];
        groups[scope].push(art);
      }
    }

    return groups;
  }, [filteredArtifacts, episodeMap, characterMap]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden" id="psb4_artifact_list">
      {/* Search & Filters block */}
      <div className="p-3 bg-[#0d0d0d] border-b border-white/10 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope selection */}
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="bg-[#030303] text-white/80 border border-white/15 rounded px-2 py-1 text-[11px] font-mono focus:border-amber-400 focus:outline-none"
          >
            <option value="all">ALL SCOPES</option>
            {uniqueScopes.map((scope) => (
              <option key={scope} value={scope}>
                {scope.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Type selection */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#030303] text-white/80 border border-white/15 rounded px-2 py-1 text-[11px] font-mono focus:border-amber-400 focus:outline-none max-w-xs"
          >
            <option value="all">ALL TYPES</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {formatTypeLabel(type)}
              </option>
            ))}
          </select>

          {/* Filter authorEdited */}
          <button
            onClick={() => setAuthorEditedOnly(!authorEditedOnly)}
            className={`px-2 py-1 text-[10px] font-mono tracking-wide rounded border uppercase leading-none transition-all ${
              authorEditedOnly
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
            }`}
          >
            Author-Edited
          </button>
        </div>
      </div>

      {/* Main grouping scrolling area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {filteredArtifacts.length === 0 ? (
          <p className="text-[11px] text-white/50 uppercase tracking-widest text-center py-12">
            No Artifacts Found
          </p>
        ) : (
          <>
            {/* ARC artifacts */}
            {groupedData.arc && groupedData.arc.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-white/60 font-mono font-semibold flex items-center gap-1.5 px-1 py-1 bg-white/5 rounded">
                  <Layers size={12} className="text-amber-400" />
                  Arc Scope
                </div>
                <div className="space-y-0.5">
                  {groupedData.arc.map((art: Psb4Artifact) => (
                    <ArtifactRow
                      key={art.id}
                      art={art}
                      selected={art.id === selectedArtifactId}
                      onClick={() => onSelectArtifact(art.id)}
                      formatLabel={formatTypeLabel}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* EPISODE artifacts */}
            {groupedData.episode && Object.keys(groupedData.episode).length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-white/60 font-mono font-semibold flex items-center gap-1.5 px-1 py-1 bg-white/5 rounded">
                  <LayoutGrid size={12} className="text-amber-400" />
                  Episode Scope
                </div>
                <div className="pl-1 space-y-3">
                  {Object.keys(groupedData.episode).map((epTitle) => (
                    <div key={epTitle} className="space-y-1">
                      <div className="text-[10px] font-sans font-medium text-white/80 border-b border-white/5 pb-0.5 ml-1">
                        {epTitle}
                      </div>
                      <div className="space-y-0.5">
                        {groupedData.episode[epTitle].map((art: Psb4Artifact) => (
                          <ArtifactRow
                            key={art.id}
                            art={art}
                            selected={art.id === selectedArtifactId}
                            onClick={() => onSelectArtifact(art.id)}
                            formatLabel={formatTypeLabel}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CHARACTER artifacts */}
            {groupedData.character && Object.keys(groupedData.character).length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-white/60 font-mono font-semibold flex items-center gap-1.5 px-1 py-1 bg-white/5 rounded">
                  <User size={12} className="text-amber-400" />
                  Character Scope
                </div>
                <div className="pl-1 space-y-3">
                  {Object.keys(groupedData.character).map((charName) => (
                    <div key={charName} className="space-y-1">
                      <div className="text-[10px] font-sans font-medium text-white/80 border-b border-white/5 pb-0.5 ml-1">
                        {charName}
                      </div>
                      <div className="space-y-0.5">
                        {groupedData.character[charName].map((art: Psb4Artifact) => (
                          <ArtifactRow
                            key={art.id}
                            art={art}
                            selected={art.id === selectedArtifactId}
                            onClick={() => onSelectArtifact(art.id)}
                            formatLabel={formatTypeLabel}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RELATIONSHIP artifacts */}
            {groupedData.relationship && groupedData.relationship.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-white/60 font-mono font-semibold flex items-center gap-1.5 px-1 py-1 bg-white/5 rounded">
                  <HelpCircle size={12} className="text-amber-400" />
                  Relationship Scope
                </div>
                <div className="space-y-0.5">
                  {groupedData.relationship.map((art: Psb4Artifact) => (
                    <ArtifactRow
                      key={art.id}
                      art={art}
                      selected={art.id === selectedArtifactId}
                      onClick={() => onSelectArtifact(art.id)}
                      formatLabel={formatTypeLabel}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* MOTIF artifacts */}
            {groupedData.motif && groupedData.motif.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-white/60 font-mono font-semibold flex items-center gap-1.5 px-1 py-1 bg-white/5 rounded">
                  <Eye size={12} className="text-amber-400" />
                  Motif Scope
                </div>
                <div className="space-y-0.5">
                  {groupedData.motif.map((art: Psb4Artifact) => (
                    <ArtifactRow
                      key={art.id}
                      art={art}
                      selected={art.id === selectedArtifactId}
                      onClick={() => onSelectArtifact(art.id)}
                      formatLabel={formatTypeLabel}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Extracted Artifact Row Component
const ArtifactRow: React.FC<{
  art: Psb4Artifact;
  selected: boolean;
  onClick: () => void;
  formatLabel: (t: string) => string;
}> = ({ art, selected, onClick, formatLabel }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-2 text-left rounded border transition-colors ${
        selected
          ? 'bg-amber-950/20 border-amber-500/60 text-white'
          : 'bg-[#030303] border-white/5 hover:bg-white/5 hover:border-white/10 text-white/95'
      }`}
    >
      <div className="flex flex-col min-w-0 pr-2">
        <span className="text-xs font-sans font-medium hover:text-white truncate">
          {formatLabel(art.artifactType)}
        </span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase mt-0.5 leading-none">
          <span>Pass: {art.createdByPass}</span>
          <span>•</span>
          <span>{new Date(art.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {art.authorEdited && (
          <span className="text-[9px] font-black bg-amber-500/10 border border-amber-500/30 text-amber-300 px-1 py-0.5 rounded leading-none">
            M
          </span>
        )}
      </div>
    </button>
  );
};
