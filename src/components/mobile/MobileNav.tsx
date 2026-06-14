import React from 'react';
import { useStore } from '../../StoreContext';
import { LayoutGrid, ListTree, Zap } from 'lucide-react';

const MobileNav: React.FC = () => {
  const { state, dispatch } = useStore();
  const { view, activePath } = state;

  const tabs = [
    { id: 'm-show-home', label: 'Home', icon: LayoutGrid },
    { id: 'm-hierarchy', label: 'Tree', icon: ListTree },
    { id: 'm-beat-review', label: 'Now', icon: Zap, disabled: activePath.beatIdx === undefined }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-6 pb-2 z-30">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = view === tab.id;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && dispatch({ type: 'SET_VIEW', view: tab.id as any })}
            disabled={isDisabled}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300
              ${isActive ? 'text-amber-500 scale-110' : isDisabled ? 'text-white/40' : 'text-white/60 active:scale-95'}
            `}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-[9px] uppercase tracking-widest font-black transition-opacity
              ${isActive ? 'opacity-100' : 'opacity-60'}
              ${isDisabled ? 'opacity-10' : ''}
            `}>
              {tab.label}
            </span>
            {isActive && (
              <div className="absolute -bottom-2 w-8 h-0.5 bg-amber-500 rounded-full blur-[1px]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default MobileNav;
