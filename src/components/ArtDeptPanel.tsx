import React from 'react';
import { useStore } from '../StoreContext';
import { StyleConfigSection } from "./artdept/StyleConfigSection";
import { EnsembleStyleTest } from "./artdept/EnsembleStyleTest";
import { ReferenceVault } from "./artdept/ReferenceVault";

const ArtDeptPanel: React.FC = () => {
  const { state } = useStore();
  const { currentShow } = state;

  if (!currentShow) return null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#070707]">
      <StyleConfigSection />
      <EnsembleStyleTest />
      <ReferenceVault />
    </div>
  );
};

export default ArtDeptPanel;
