import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { Show } from '../types/models';
import { downloadPcbProductionPackage } from '../utils/pcbProductionPackage';

interface PcbExportButtonProps {
  show: Show;
}

const PcbExportButton: React.FC<PcbExportButtonProps> = ({ show }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const pkg = await downloadPcbProductionPackage(show);
      const panelCount = pkg.comicAssets.reduce((total, asset) => total + asset.panels.length, 0);
      const message = [
        `Exported ${pkg.series.title} for Prestige Comic Builder.`,
        `${pkg.references.filter((reference) => reference.type === 'character').length} characters`,
        `${pkg.references.filter((reference) => reference.type === 'setting').length} settings`,
        `${pkg.comicAssets.length} ComicAssets`,
        `${panelCount} panels`,
        `${pkg.warnings.length} warning${pkg.warnings.length === 1 ? '' : 's'}`,
      ].join('\n');
      window.alert(message);
    } catch (error) {
      console.error('[PCB export] failed', error);
      window.alert(error instanceof Error ? error.message : 'Unable to export this show for Prestige Comic Builder.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={() => void handleExport()}
      disabled={isExporting}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-sm
                 text-[10px] font-black uppercase tracking-widest text-white/70
                 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-wait"
      title="Export the entire show as a Prestige Comic Builder production package"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden xl:inline">{isExporting ? 'Exporting…' : 'Export for PCB'}</span>
    </button>
  );
};

export default PcbExportButton;
