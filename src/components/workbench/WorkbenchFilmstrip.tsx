import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Show } from '../../types/show';
import { FilmstripItem } from './useWorkbenchSelection';
import { AssetStorage } from '../../storage';

interface FileThumbnailProps {
  assetId: string | undefined;
  pageUid: string;
  cache: React.MutableRefObject<Map<string, string>>;
  skipLazy: boolean;
}

const FileThumbnail: React.FC<FileThumbnailProps> = ({ assetId, pageUid, cache, skipLazy }) => {
  const [inView, setInView] = useState(skipLazy);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'missing_blob' | 'no_entry'>(
    !assetId ? 'no_entry' : 'loading'
  );
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skipLazy || !assetId) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '200px', // load slightly before they're visible
      }
    );

    const currentEl = containerRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      observer.disconnect();
    };
  }, [assetId, skipLazy]);

  useEffect(() => {
    if (!inView || !assetId) return;

    // Check cache
    const cachedUrl = cache.current.get(assetId);
    if (cachedUrl) {
      setUrl(cachedUrl);
      setStatus('loaded');
      return;
    }

    let active = true;
    setStatus('loading');

    AssetStorage.getBlobUrl(assetId)
      .then((blobUrl) => {
        if (!active) return;
        if (blobUrl) {
          cache.current.set(assetId, blobUrl);
          setUrl(blobUrl);
          setStatus('loaded');
        } else {
          setStatus('missing_blob');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('missing_blob');
        }
      });

    return () => {
      active = false;
    };
  }, [assetId, inView, cache]);

  // Unified css sizing for thumbnails
  const thumbBaseClasses = "w-10 h-14 md:w-16 md:h-20 flex items-center justify-center rounded-sm text-center relative select-none overflow-hidden transition-all duration-150 border";

  if (!assetId || status === 'no_entry') {
    // Grey for 'no entry yet'
    return (
      <div 
        ref={containerRef}
        className={`${thumbBaseClasses} bg-neutral-800 border-neutral-700 text-neutral-500`}
        title="No entry yet"
      >
        <span className="text-[10px] font-mono leading-none break-all p-1">
          {pageUid.split('-').pop()}
        </span>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div 
        ref={containerRef}
        className={`${thumbBaseClasses} bg-[#121212]/50 border-white/10 animate-pulse text-white/50`}
      >
        <span className="text-[10px] font-mono">...</span>
      </div>
    );
  }

  if (status === 'missing_blob') {
    // Red for 'entry exists but blob missing (evicted, deleted)'
    return (
      <div 
        ref={containerRef}
        className={`${thumbBaseClasses} bg-red-950/80 border-red-800/80 text-red-500 flex flex-col items-center justify-center p-1 gap-1`}
        title={`Asset ${assetId} missing from storage`}
      >
        <span className="text-xs leading-none font-bold">⚠️</span>
        <span className="text-[10px] font-mono truncate max-w-[55px] leading-none opacity-80">
          {pageUid.split('-').pop()}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <img
        src={url!}
        alt="Page Thumbnail"
        className="w-10 h-14 md:w-16 md:h-20 object-cover rounded-sm border border-white/10"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

interface WorkbenchFilmstripProps {
  show: Show;
  pages: FilmstripItem[];
  focusedPage: FilmstripItem | null;
  onPageSelect: (pageUid: string) => void;
}

interface ScenePageGroup {
  sceneId: string;
  sceneFid: string;
  sceneTitle: string;
  firstPageUid: string;
  pages: FilmstripItem[];
}

export const WorkbenchFilmstrip: React.FC<WorkbenchFilmstripProps> = ({
  show,
  pages,
  focusedPage,
  onPageSelect
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blobCacheRef = useRef<Map<string, string>>(new Map());

  // Revoke all blob URLs on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (blobCacheRef.current) {
        blobCacheRef.current.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        blobCacheRef.current.clear();
      }
    };
  }, []);

  // Performance optimization: skip IntersectionObserver lazy-loading if total pages < 30
  const skipLazyLoading = pages.length < 30;

  // Group pages by scene for clear visual boundaries and headers
  const sceneGroups = useMemo(() => {
    const groups: ScenePageGroup[] = [];
    pages.forEach(p => {
      const sceneId = p.sceneUid || 'scene-unknown';
      const sceneFid = p.sceneUid ? `SC-${p.sceneUid.slice(0, 4)}` : 'SC-UNK';
      const sceneTitle = p.sceneTitle || 'Scene Context';

      let group = groups.find(g => g.sceneId === sceneId);
      if (!group) {
        group = {
          sceneId,
          sceneFid,
          sceneTitle,
          firstPageUid: p.productionPage.uid,
          pages: []
        };
        groups.push(group);
      }
      group.pages.push(p);
    });
    return groups;
  }, [pages]);

  // Auto-scroll-to-focused-page implementation
  useEffect(() => {
    if (!focusedPage || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const element = document.getElementById(`filmstrip-thumb-${focusedPage.productionPage.uid}`);
    if (!element) return;

    const containerRect = container.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();

    const relativeLeft = elemRect.left - containerRect.left;
    const relativeRight = elemRect.right - containerRect.left;

    // Check if fully in viewport
    const isFullyVisible = relativeLeft >= 0 && relativeRight <= container.clientWidth;
    if (isFullyVisible) {
      return;
    }

    // Decide if smooth or instant scroll
    const distanceLeft = relativeLeft < 0 ? Math.abs(relativeLeft) : 0;
    const distanceRight = relativeRight > container.clientWidth ? relativeRight - container.clientWidth : 0;
    const distance = Math.max(distanceLeft, distanceRight);

    // If far off-screen (> 500px scroll delta), scroll instantly. Else, scroll smoothly.
    const isFar = distance > 500;
    const behavior = isFar ? 'auto' : 'smooth';

    element.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
  }, [focusedPage?.productionPage.uid]);

  // Empty-filmstrip state
  if (pages.length === 0) {
    return (
      <div className="w-full bg-[#0a0a0a] border-t border-white/20 px-6 py-10 flex flex-col items-center justify-center gap-1.5 shrink-0 select-none text-center">
        <p className="text-[11px] text-white/70 uppercase tracking-widest font-mono font-bold">
          No pages produced yet
        </p>
        <p className="text-xs text-white/60 max-w-md">
          Run GNDS and Promote to Production first.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0a0a0a] border-t border-white/20 px-3 py-1.5 flex flex-col gap-1 shrink-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/70">
          Show Production Filmstrip ({pages.length} Pages)
        </h3>
        <span className="text-[10px] text-white/60 font-mono">
          Use ← and → arrows to navigate
        </span>
      </div>

      <div 
        ref={scrollContainerRef}
        className="w-full flex items-center overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-white/20"
      >
        <div className="flex items-center">
          {sceneGroups.map((group, groupIdx) => (
            <React.Fragment key={group.sceneId}>
              {/* Visible separator between adjacent scene groups (1px line, slight gap) */}
              {groupIdx > 0 && (
                <div className="w-[1.5px] h-14 bg-white/10 shrink-0 self-end mx-2 opacity-70" />
              )}
              
              {/* Scene Page Group Wrapper */}
              <div className="flex flex-col gap-1 shrink-0">
                {/* Scene Title Label above the current group */}
                <div className="flex items-center select-none z-10 max-w-[110px] md:max-w-[140px] px-0.5 mb-0.5">
                  <button
                    onClick={() => onPageSelect(group.firstPageUid)}
                    title={group.sceneTitle}
                    className="text-[9px] text-amber-500 font-mono font-bold uppercase tracking-wider hover:text-amber-400 truncate cursor-pointer text-left focus:outline-none transition-colors border-b border-dashed border-amber-500/20 hover:border-amber-400 block max-w-full"
                  >
                    {group.sceneTitle.length <= 16 ? group.sceneTitle : group.sceneFid}
                  </button>
                </div>

                {/* Vertical Thumbnails row inside scene group */}
                <div className="flex items-center gap-1">
                  {group.pages.map((page) => {
                    const isFocused = focusedPage?.productionPage.uid === page.productionPage.uid;
                    const displayPageLabel = `P.${page.pageNumber}`;

                    return (
                      <button
                        key={page.productionPage.uid}
                        id={`filmstrip-thumb-${page.productionPage.uid}`}
                        onClick={() => onPageSelect(page.productionPage.uid)}
                        className={`flex flex-col items-center gap-1 p-0.5 rounded-md transition-all duration-150 shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50
                          ${isFocused
                            ? 'border-2 border-amber-500 scale-105 brightness-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] z-10 bg-white/5'
                            : 'border-2 border-transparent hover:scale-102 hover:border-white/20 hover:brightness-105 active:scale-98 opacity-85 hover:opacity-100'
                          }`}
                      >
                        <FileThumbnail 
                          assetId={page.activeImageVersion?.assetId} 
                          pageUid={page.productionPage.uid}
                          cache={blobCacheRef}
                          skipLazy={skipLazyLoading}
                        />
                        <span className={`text-[10px] font-mono leading-none transition-colors duration-150 mt-1 ${isFocused ? 'text-amber-400 font-black' : 'text-white/70'}`}>
                          {displayPageLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkbenchFilmstrip;
