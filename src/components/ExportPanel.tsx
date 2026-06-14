import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { VaultStorage } from '../storage/VaultStorage';
import { AssetStorage } from '../storage/AssetStorage';
import { buildProductionReviewDocument } from '../utils/exportProductionReviewDocument';
import { formatProductionReviewDocument } from '../utils/formatProductionReviewDocument';
import { buildFoundationBible, formatFoundationBible } from '../utils/exportFoundationBible';
import { generateTeleplay } from '../utils/exports/teleplay';
import { generateIssuePDF } from '../utils/exports/issuePDF';
import jsPDF from 'jspdf';
import { Archive, FileText, Download, Users, BookOpen, Database, History, Info, Image, Bug, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { generateShowAssetLibrary } from '../utils/exports/showAssetLibrary';
import { generateProductionIssueZip } from '../utils/exports/issueExportProduction';
import { generateProductionIssuePDF } from '../utils/exports/issuePDFProduction';
import { generatePsb4DebugBundle } from '../utils/exports/debugBundle';
import { PUBLICATION_PRESETS } from '../constants/generation.constants';

const ExportSection: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="glass p-6 rounded-lg border border-white/10 space-y-4">
    <div>
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-white/60 leading-relaxed font-sans">{description}</p>
    </div>
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      {children}
    </div>
  </div>
);

const ExportButton: React.FC<{ label: string; isRunning: boolean; onClick: () => void }> = ({ label, isRunning, onClick }) => (
  <button
    onClick={onClick}
    disabled={isRunning}
    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest transition-all rounded-sm flex items-center justify-center gap-1.5"
  >
    {isRunning ? (
      <>
        <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        Processing...
      </>
    ) : (
      <>
        <Download size={14} />
        {label}
      </>
    )}
  </button>
);

const ExportPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const [isExporting, setIsExporting] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showDebugConfirm, setShowDebugConfirm] = useState(false);
  const [isExportingDebug, setIsExportingDebug] = useState(false);

  const promotedIssues = currentShow?.issues ?? [];
  const [selectedExportIssueUid, setSelectedExportIssueUid] = useState<string>(
    promotedIssues[0]?.uid ?? ''
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(''); // empty string means raw/none
  const [isExportingProduction, setIsExportingProduction] = useState(false);
  const [isExportingProductionPdf, setIsExportingProductionPdf] = useState(false);

  if (!currentShow) return null;

  const getTitle = () => (currentShow.titleSuggestion || currentShow.name || 'show').replace(/[^a-z0-9]/gi, '_').toLowerCase();

  const exportDebugBundle = async () => {
    setIsExportingDebug(true);
    try {
      const blob = await generatePsb4DebugBundle(currentShow.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = getTitle();
      const dateStr = new Date().toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/:/g, '');
      a.download = `psb4-debug-bundle-${slug}-${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(), type: 'success',
        message: 'Export PSB4 Debug Bundle (.zip) completed successfully.',
      }});
    } catch (e: any) {
      console.error(e);
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(), type: 'error',
        message: `Failed to export debug bundle: ${e.message}`,
      }});
    } finally {
      setIsExportingDebug(false);
      setShowDebugConfirm(false);
    }
  };

  const exportGenerationLog = () => {
    if (!currentShow.generationLog || currentShow.generationLog.length === 0) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(), type: 'warning',
        message: 'No generation log entries to export.',
      }});
      return;
    }

    const logData = {
      show: currentShow.titleSuggestion || currentShow.name,
      showCode: currentShow.showCode,
      exportedAt: new Date().toISOString(),
      totalEntries: currentShow.generationLog.length,
      entries: currentShow.generationLog.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp).toISOString(),
      })),
    };

    const json = JSON.stringify(logData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getTitle()}_generation_log_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCurrentShow = async () => {
    setIsExporting(true);
    try {
      const blob = await VaultStorage.exportShow(currentShow.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getTitle()}_vault_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportProductionReviewTxt = () => {
    try {
      const doc = buildProductionReviewDocument(currentShow);
      const text = formatProductionReviewDocument(doc);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getTitle()}_production_review_v${currentShow.draftVersion}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(), type: 'error',
        message: 'Failed to build production review document.',
      }});
    }
  };

  const exportProductionReviewPdf = async () => {
    setIsExporting(true);
    try {
      const docData = buildProductionReviewDocument(currentShow);
      const text = formatProductionReviewDocument(docData);
      const lines = text.split('\n');
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      
      let y = 1;
      const margin = 0.75;
      const pageHeight = 11;
      const lineHeight = 0.15;
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        const splitLines = doc.splitTextToSize(line, 8.5 - margin * 2);
        for (let j = 0; j < splitLines.length; j++) {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(splitLines[j], margin, y);
          y += lineHeight;
        }
      }
      
      doc.save(`${getTitle()}_production_review_v${currentShow.draftVersion}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportTeleplayTxt = async () => {
    const text = await generateTeleplay(currentShow, { kind: 'teleplay-show', label: currentShow.name });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getTitle()}_teleplay_draft_v${currentShow.draftVersion}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTeleplayPdf = async () => {
    setIsExporting(true);
    try {
      const text = await generateTeleplay(currentShow, { kind: 'teleplay-show', label: currentShow.name });
      const lines = text.split('\n');
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(12);
      
      let y = 1;
      const margin = 1;
      const pageHeight = 11;
      const lineHeight = 0.2;
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        const splitLines = doc.splitTextToSize(line, 8.5 - margin * 2);
        for (let j = 0; j < splitLines.length; j++) {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(splitLines[j], margin, y);
          y += lineHeight;
        }
      }
      
      doc.save(`${getTitle()}_teleplay_draft_v${currentShow.draftVersion}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportFoundationBibleTxt = () => {
    try {
      const doc = buildFoundationBible(currentShow);
      const text = formatFoundationBible(doc);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getTitle()}_foundation_bible_v${currentShow.draftVersion}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const exportFoundationBiblePdf = async () => {
    setIsExporting(true);
    try {
      const docData = buildFoundationBible(currentShow);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
      const margin = 1;
      const pageHeight = 11;
      const pageWidth = 8.5;
      const lineHeight = 0.18;
      let y = margin;

      const checkPage = (heightNeeded: number) => {
        if (y + heightNeeded > pageHeight - margin) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      const addText = (text: string, fontStyle = 'normal', fontSize = 10, marginBottom = 0.1) => {
        if (!text) return;
        doc.setFont('helvetica', fontStyle);
        doc.setFontSize(fontSize);
        const splitLines = doc.splitTextToSize(text, pageWidth - margin * 2);
        splitLines.forEach((line: string) => {
          checkPage(lineHeight);
          doc.text(line, margin, y);
          y += lineHeight;
        });
        y += marginBottom;
      };

      const addSection = (title: string, content: string | string[]) => {
        if (!content || (Array.isArray(content) && content.length === 0)) return;
        addText(title, 'bold', 12, 0.05);
        if (Array.isArray(content)) {
          content.forEach(line => addText(`- ${line}`, 'normal', 10, 0));
          y += 0.15;
        } else {
          addText(content, 'normal', 10, 0.15);
        }
      };

      // Header
      addText(`Show: ${docData.showTitle.toUpperCase()}`, 'bold', 18, 0.2);
      addText("FOUNDATION BIBLE", 'bold', 14, 0.3);

      addSection("PREMISE", docData.premise);
      addSection("THEMES", docData.themes);
      if (docData.register) addSection("SHOW REGISTER", docData.register);
      
      if (docData.writingRules) {
        addSection("WRITING RULES — DIALOGUE", docData.writingRules.dialogueRules);
        addSection("WRITING RULES — BLOCKING", docData.writingRules.blockingRules);
        addSection("WRITING RULES — STRUCTURE", docData.writingRules.structureRules);
        addSection("WRITING RULES — CRAFT NOTES", docData.writingRules.craftNotes);
      }

      if (docData.richInput) addSection("RICH INPUT", docData.richInput);
      
      if (docData.structureConfig) {
        const sc = docData.structureConfig;
        const configText = [
          `Episodes per Season: ${sc.episodesPerSeason ?? 1}`,
          `Acts per Episode: ${sc.actsPerEpisode ?? 1}`,
          `Scenes per Act: ${sc.scenesPerAct ?? 1}`,
          `Beats per Scene: ${sc.beatsPerScene ?? 1}`
        ].join('\n');
        addSection("STRUCTURE CONFIG", configText);
      }

      if (docData.comicStyle) {
        const cs = docData.comicStyle;
        const styleText = [
          `Artist Style: ${cs.artistStyle}`,
          `Color Palette: ${cs.colorPalette}`,
          `Line Weight: ${cs.lineWeight}`,
          cs.compositionPrompt ? `Composition: ${cs.compositionPrompt}` : '',
          cs.negativePrompt ? `Negative Prompt: ${cs.negativePrompt}` : ''
        ].filter(Boolean).join('\n');
        addSection("COMIC STYLE", styleText);
      }

      if (docData.narrativeMechanism) addSection("NARRATIVE MECHANISM", docData.narrativeMechanism);
      if (docData.expandedBible) addSection("EXPANDED BIBLE", docData.expandedBible);

      // Characters
      doc.addPage();
      y = margin;
      addText("ENSEMBLE CAST", 'bold', 16, 0.3);

      for (const char of docData.characters) {
        checkPage(1.5); // Ensure enough space for at least the header and portrait
        const startY = y;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const header = `${char.name.toUpperCase()} [${char.handle}]${char.isProtagonist ? ' — Protagonist' : ''}`;
        doc.text(header, margin, y);
        y += lineHeight;

        const portraitData = char.portraitAssetId ? await AssetStorage.getDataUri(char.portraitAssetId) : null;
        const thumbW = 1.0;
        const thumbH = 1.33;

        if (portraitData) {
          doc.addImage(portraitData, 'PNG', pageWidth - margin - thumbW, startY, thumbW, thumbH);
        }

        const charMarginRight = portraitData ? margin + thumbW + 0.2 : margin;
        const wrapWidth = pageWidth - margin - charMarginRight;

        const addCharLine = (label: string, val?: any) => {
          if (!val) return;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          const labelText = `${label}: `;
          const labelW = doc.getTextWidth(labelText);
          
          doc.text(labelText, margin, y);
          
          doc.setFont('helvetica', 'normal');
          const content = String(val);
          const splitLines = doc.splitTextToSize(content, wrapWidth - labelW);
          
          splitLines.forEach((line: string, idx: number) => {
            checkPage(lineHeight);
            if (idx === 0) {
              doc.text(line, margin + labelW, y);
            } else {
              doc.text(line, margin, y);
            }
            y += lineHeight;
          });
        };

        addCharLine('Role', char.role);
        addCharLine('Summary', char.summary);
        addCharLine('Physical', char.physicalDescription);
        addCharLine('Identifying Feature', char.identifyingFeature);
        addCharLine('Visual Anchor', char.visualAnchor);
        addCharLine('Voice Profile', char.voiceProfile);
        addCharLine('Evolution', char.evolution);
        addCharLine('Casting Notes', char.castingNotes);

        y += 0.25; // Gap between characters
        if (portraitData && y < startY + thumbH) {
          y = startY + thumbH + 0.1;
        }
      }

      // Settings
      doc.addPage();
      y = margin;
      addText("SETTING ANCHORS", 'bold', 16, 0.3);
      for (const setting of docData.settings) {
        addSection(setting.name.toUpperCase(), [
          setting.mood ? `Mood: ${setting.mood}` : '',
          `Description: ${setting.physicalDescription}`
        ].filter(Boolean));
      }

      doc.save(`${getTitle()}_foundation_bible_v${currentShow.draftVersion}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportCharactersPdf = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });
      
      const margin = 1;
      const pageHeight = 11;
      const pageWidth = 8.5;
      const lineHeight = 0.25;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text(currentShow.titleSuggestion || currentShow.name, margin, 1);
      doc.setFontSize(14);
      doc.text('Ensemble Cast', margin, 1.3);
      
      let y = 2;
      
      const checkPage = (heightNeeded: number) => {
        if (y + heightNeeded > pageHeight - margin) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      for (const char of currentShow.characters) {
        // Estimate space needed: portrait (3.33) + header + role + some fields
        checkPage(4.0);

        const portraitData = char.portraitAssetId ? await AssetStorage.getDataUri(char.portraitAssetId) : null;
        const fullW = 2.5;
        const fullH = 3.33;

        if (portraitData) {
          doc.addImage(portraitData, 'PNG', margin, y, fullW, fullH);
          y += fullH + 0.2;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${char.name} (${char.handle})`, margin, y);
        y += lineHeight;
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(12);
        doc.text(char.role || 'Role TBD', margin, y);
        y += lineHeight * 1.5;
        
        const addField = (label: string, content?: string) => {
          if (!content) return;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          const labelText = `${label}: `;
          const labelW = doc.getTextWidth(labelText);
          
          doc.text(labelText, margin, y);
          
          doc.setFont('helvetica', 'normal');
          const splitLines = doc.splitTextToSize(content, pageWidth - margin * 2 - labelW);
          
          splitLines.forEach((line: string, idx: number) => {
            checkPage(lineHeight);
            if (idx === 0) {
              doc.text(line, margin + labelW, y);
            } else {
              doc.text(line, margin, y);
            }
            y += lineHeight;
          });
        };
        
        addField('Summary', char.summary);
        addField('Physical', char.physicalDescription);
        addField('Identifying Feature', char.identifyingFeature);
        addField('Visual Anchor', char.visualAnchor);
        addField('Voice Profile', char.voiceProfile);
        addField('Voice Rule', char.voiceRule);
        addField('Voice Constraints', char.voiceConstraints);
        addField('Voice Card', char.voiceCard);
        addField('Casting Notes', char.castingNotes);
        addField('Evolution', char.evolution);
        if (char.captionColor) addField('Caption Color', char.captionColor);
        if (char.memoryBleedPalette) addField('Memory Bleed Palette', char.memoryBleedPalette);
        
        y += lineHeight * 2;
      }
      
      doc.save(`${getTitle()}_characters_v${currentShow.draftVersion}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportJson = () => {
    const json = JSON.stringify(currentShow, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getTitle()}_v${currentShow.draftVersion}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAssetLibrary = async () => {
    setIsExporting(true);
    try {
      const blob = await generateShowAssetLibrary(currentShow, { includeArchived });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getTitle()}_assets_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(), type: 'error',
        message: 'Failed to generate asset library zip.',
      }});
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportProductionIssue = async () => {
    if (!currentShow) return;
    const targetUid = promotedIssues.some(i => i.uid === selectedExportIssueUid)
      ? selectedExportIssueUid
      : (promotedIssues[0]?.uid ?? '');
    if (!targetUid) return;
    
    setIsExportingProduction(true);
    try {
      const blob = await generateProductionIssueZip(
        currentShow, targetUid, {
          presetId: selectedPreset || undefined,
          includeManifest: true,
        }
      );
      const issue = promotedIssues.find(
        i => i.uid === targetUid
      );
      const filename =
        `${issue?.issueCode ?? 'issue'}_export.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Export failed: ${err.message}`
      }});
    } finally { setIsExportingProduction(false); }
  };

  const handleExportProductionPDF = async () => {
    if (!currentShow) return;
    const targetUid = promotedIssues.some(i => i.uid === selectedExportIssueUid)
      ? selectedExportIssueUid
      : (promotedIssues[0]?.uid ?? '');
    if (!targetUid) return;

    setIsExportingProductionPdf(true);
    try {
      const blob = await generateProductionIssuePDF(
        currentShow, targetUid, selectedPreset || undefined
      );
      const issue = promotedIssues.find(
        i => i.uid === targetUid
      );
      const filename =
        `${issue?.issueCode ?? 'issue'}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `PDF export failed: ${err.message}`
      }});
    } finally { setIsExportingProductionPdf(false); }
  };

  const BentoCard = ({ 
    title, 
    description, 
    icon: Icon, 
    onClick, 
    disabled, 
    primary, 
    className = "" 
  }: { 
    title: string; 
    description: string; 
    icon: any; 
    onClick: () => void; 
    disabled?: boolean; 
    primary?: boolean;
    className?: string;
  }) => (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`glass p-6 flex flex-col justify-between group cursor-pointer transition-all ${primary ? 'border-amber-500/50 bg-amber-500/5' : 'hover:bg-white/5'} ${className}`}
      onClick={!disabled ? onClick : undefined}
    >
      <div className="space-y-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${primary ? 'bg-amber-500 text-black' : 'bg-white/10 text-white group-hover:text-amber-500'}`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className={`text-lg font-bold ${primary ? 'text-amber-500' : 'text-white'}`}>{title}</h3>
          <p className="text-xs text-white/60 leading-relaxed mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">
          {disabled ? 'Processing...' : 'Download'}
        </span>
        <Download size={14} className="text-white/60 group-hover:text-amber-500 transition-colors" />
      </div>
    </motion.div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070707] text-white p-6 md:p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Export</h1>
            <p className="text-white/60 text-sm flex items-center gap-2">
              <Info size={14} className="text-amber-500" />
              Generate production-ready deliverables for <span className="text-white font-bold">{currentShow.name}</span>
            </p>
          </div>
          <div className="text-[10px] font-mono text-white/60 uppercase tracking-widest">
            Draft Version {currentShow.draftVersion} • {currentShow.showCode}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div 
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeArchived ? 'bg-amber-500 border-amber-500' : 'border-white/30 group-hover:border-amber-500/50'}`}
              onClick={() => setIncludeArchived(!includeArchived)}
            >
              {includeArchived && <div className="w-2 h-2 bg-black rounded-sm" />}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/70 group-hover:text-white">Include archived versions in exports</span>
          </label>
          <div className="w-px h-4 bg-white/10" />
          <p className="text-[10px] text-white/60 italic">Applies to Asset Library and Issue Zip exports.</p>
        </div>

        {promotedIssues.length > 0 && (
          <ExportSection
            title="Promoted Issues"
            description="Export a GNDS-promoted issue. Page order follows the canonical Issue Manifest."
          >
            <div className="flex flex-col sm:flex-row gap-4 items-center w-full justify-between">
              <div className="flex flex-col sm:flex-row gap-4 items-center w-full sm:w-auto">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60">Select Promoted Issue</span>
                  <select
                    value={selectedExportIssueUid}
                    onChange={e => setSelectedExportIssueUid(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-sm px-3 py-1.5 text-xs text-white uppercase font-mono tracking-widest focus:border-amber-500 outline-none w-full sm:w-auto min-w-[240px]"
                  >
                    {promotedIssues.map(iss => (
                      <option key={iss.uid} value={iss.uid} className="bg-neutral-900 text-white">
                        {iss.issueCode} — {iss.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60">Target Preset / Resolution</span>
                  <select
                    value={selectedPreset}
                    onChange={e => setSelectedPreset(e.target.value)}
                    className="bg-neutral-900 border border-white/10 rounded-sm px-3 py-1.5 text-xs text-white uppercase font-mono tracking-widest focus:border-amber-500 outline-none w-full sm:w-auto min-w-[240px]"
                  >
                    <option value="" className="bg-neutral-900 text-white">Raw / Unscaled</option>
                    {PUBLICATION_PRESETS.map(p => (
                      <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                        {p.label} ({p.targetWidth}x{p.targetHeight})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full sm:w-auto pt-4 sm:pt-0 shrink-0 flex flex-col sm:flex-row gap-2">
                <ExportButton
                  label="Export Issue ZIP"
                  isRunning={isExportingProduction}
                  onClick={handleExportProductionIssue}
                />
                <ExportButton
                  label="Export Issue PDF"
                  isRunning={isExportingProductionPdf}
                  onClick={handleExportProductionPDF}
                />
              </div>
            </div>
          </ExportSection>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[240px]">
          {/* PRIMARY: SHOW VAULT */}
          <BentoCard 
            title="Show Vault (.zip)"
            description="The master archive. Contains the full show data and all associated character portraits, references, and core assets. Use this for complete backup and restore."
            icon={Archive}
            onClick={exportCurrentShow}
            disabled={isExporting}
            primary
            className="md:col-span-2 md:row-span-2"
          />

          {/* PRIMARY: PRODUCTION REVIEW DOCUMENT PDF */}
          <BentoCard 
            title="Production Review (.pdf)"
            description="Hierarchical comic-production review packet. Includes acts, scenes, beats, visuals, dialogue, panel planning, and production state."
            icon={FileText}
            onClick={exportProductionReviewPdf}
            disabled={isExporting}
            className="md:col-span-1"
          />

          {/* PRIMARY: PRODUCTION REVIEW DOCUMENT TXT */}
          <BentoCard 
            title="Production Review (.txt)"
            description="Plain text hierarchical outline of the production state. Best for detailed review of raw source data and comic planning."
            icon={FileText}
            onClick={exportProductionReviewTxt}
            className="md:col-span-1"
          />

          {/* SECONDARY: TELEPLAY DRAFT PDF */}
          <BentoCard 
            title="Teleplay Draft (.pdf)"
            description="Optional script-style reading draft. Useful for dialogue and story flow review. Not the primary production artifact."
            icon={FileText}
            onClick={exportTeleplayPdf}
            disabled={isExporting}
            className="md:col-span-1"
          />

          {/* SECONDARY: TELEPLAY DRAFT TXT */}
          <BentoCard 
            title="Teleplay Draft (.txt)"
            description="Plain text version of the script-style reading draft."
            icon={FileText}
            onClick={exportTeleplayTxt}
            className="md:col-span-1"
          />

          {/* TERTIARY: FOUNDATION BIBLE PDF */}
          <BentoCard 
            title="Foundation Bible (.pdf)"
            description="The project DNA. Premise, themes, narrative mechanisms, and world-building details."
            icon={BookOpen}
            onClick={exportFoundationBiblePdf}
            disabled={isExporting}
            className="md:col-span-1"
          />

          {/* TERTIARY: FOUNDATION BIBLE TXT */}
          <BentoCard 
            title="Foundation Bible (.txt)"
            description="Plain text version of the foundation bible."
            icon={BookOpen}
            onClick={exportFoundationBibleTxt}
            className="md:col-span-1"
          />

          {/* TERTIARY: CHARACTERS */}
          <BentoCard 
            title="Ensemble Cast (.pdf)"
            description="Full character bible including summaries, physical traits, and casting notes for the entire cast."
            icon={Users}
            onClick={exportCharactersPdf}
            disabled={isExporting}
            className="md:col-span-1"
          />

          {/* TECHNICAL: RAW DATA */}
          <BentoCard 
            title="Raw Data (.json)"
            description="Technical JSON export of the show structure. Useful for developers or custom processing."
            icon={Database}
            onClick={exportJson}
            className="md:col-span-1"
          />

          {/* TECHNICAL: LOG */}
          <BentoCard 
            title="Generation Log (.json)"
            description={`Full prompt history for all generated assets. ${currentShow.generationLog?.length ?? 0} entries preserved.`}
            icon={History}
            onClick={exportGenerationLog}
            className="md:col-span-1 lg:col-span-2"
          />

          {/* ASSET LIBRARY */}
          <BentoCard 
            title="All Show Images (.zip)"
            description="Exports every visual asset in IndexedDB. Organized by character, setting, and issue with a manifest.json lookup."
            icon={Image}
            onClick={exportAssetLibrary}
            disabled={isExporting}
            className="md:col-span-1 lg:col-span-2"
          />

          {/* PSB4 DEBUG BUNDLE */}
          <BentoCard 
            title="Export PSB4 Debug Bundle (.zip)"
            description="Diagnostic capture of all PSB4 run parameters, console history, prompts, raw outputs, scene alignments, asset registries, and preflight logs."
            icon={Bug}
            onClick={() => setShowDebugConfirm(true)}
            disabled={isExportingDebug}
            className="md:col-span-1 lg:col-span-2 border-amber-500/20 hover:border-amber-500/40"
          />
        </div>

        {showDebugConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-950 border border-white/10 rounded-sm p-6 max-w-md w-full space-y-6 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider text-sm border-b border-white/10 pb-2">
                  <Bug size={18} />
                  <span>Confirm Debug Bundle Export</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed font-sans">
                  This debug bundle includes story text, prompts, model responses, replay console entries, artifacts, and referenced assets for this show. It is intended for debugging.
                </p>
              </div>
              <div className="flex justify-end gap-3 font-mono text-[10px] uppercase tracking-widest">
                <button
                  onClick={() => setShowDebugConfirm(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/60 hover:text-white transition-colors rounded-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={exportDebugBundle}
                  disabled={isExportingDebug}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black transition-all rounded-sm flex items-center gap-1.5"
                >
                  {isExportingDebug ? 'Packaging...' : 'Confirm & Export'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-12 border-t border-white/10">
          <p className="text-[10px] text-white/60 uppercase tracking-[0.2em] text-center">
            Prestige Show Builder • Production Export Module • D215 Architecture
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
