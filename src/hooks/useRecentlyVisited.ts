import { useState, useEffect } from 'react';
import { NodePath } from '../types/models';

export interface VisitedNode {
  path: NodePath;
  label: string;
  timestamp: number;
}

export function useRecentlyVisited() {
  const [visited, setVisited] = useState<VisitedNode[]>([]);

  const addVisit = (path: NodePath, label: string) => {
    setVisited(prev => {
      // Remove existing entry for same path if it exists
      const filtered = prev.filter(v => 
        v.path.seasonIdx !== path.seasonIdx ||
        v.path.episodeIdx !== path.episodeIdx ||
        v.path.actIdx !== path.actIdx ||
        v.path.sceneIdx !== path.sceneIdx ||
        v.path.beatIdx !== path.beatIdx
      );
      
      const newVisit = { path, label, timestamp: Date.now() };
      return [newVisit, ...filtered].slice(0, 5);
    });
  };

  return { visited, addVisit };
}
