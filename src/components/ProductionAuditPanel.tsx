import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { runProductionAudit, AuditIssue, AuditReport } from '../utils/audit/productionIntegrityAudit';
import { migrateComicGalleryToImageVersions, clearComicGallery, MigrationResult } from '../utils/migration/migrateComicGallery';
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Info, 
  ShieldAlert 
} from 'lucide-react';

export const ProductionAuditPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  const [report, setReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (!currentShow) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-[#070707] text-white">
        <ShieldAlert className="w-12 h-12 text-white/50 mb-4" />
        <p className="text-sm text-white/70">No active show loaded. Switch to a show first.</p>
      </div>
    );
  }

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const generatedReport = await runProductionAudit(currentShow);
      setReport(generatedReport);
      
      // Expand all categories by default when report is run
      const categories = Array.from(new Set(generatedReport.issues.map(i => i.category)));
      const initialExp: Record<string, boolean> = {};
      categories.forEach(cat => {
        initialExp[cat] = true;
      });
      setExpandedCategories(initialExp);

      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: 'Production integrity audit complete.'
        }
      });
    } catch (err: any) {
      console.error(err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Audit failed: ${err.message}`
        }
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleMigrate = async () => {
    if (!currentShow) return;
    setIsMigrating(true);
    try {
      const result = await migrateComicGalleryToImageVersions(currentShow);
      setMigrationResult(result);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: `Migration run successfully: ${result.migrated} migrated, ${result.recovered} recovered.`
        }
      });
    } catch (err: any) {
      console.error(err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Migration failed: ${err.message}`
        }
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleClearAfterConfirm = async () => {
    if (!currentShow) return;
    setIsClearing(true);
    try {
      await clearComicGallery(currentShow);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: `comicGallery cleared successfully.`
        }
      });
      // Reset migration result state
      setMigrationResult(null);
      // Re-run the audit automatically to show updated schema metrics
      await handleRunAudit();
    } catch (err: any) {
      console.error(err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Clearing comicGallery failed: ${err.message}`
        }
      });
    } finally {
      setIsClearing(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Group issues by category for the expandable view
  const issuesByCategory = report 
    ? report.issues.reduce((acc, iss) => {
        if (!acc[iss.category]) acc[iss.category] = [];
        acc[iss.category].push(iss);
        return acc;
      }, {} as Record<string, AuditIssue[]>)
    : {};

  const allCategories = report ? Array.from(new Set(report.issues.map(i => i.category))) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-[#070707] text-white min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Production Data Integrity Audit
          </h1>
          <p className="text-xs text-white/70 mt-1 max-w-2xl leading-relaxed">
            Diagnose and verify references across ProductionPages, IssueManifests, ImageVersions, and ComicGallery entries. Runs a deep validation before initiating large structural database migrations.
          </p>
        </div>
        <button
          onClick={handleRunAudit}
          disabled={isRunning}
          id="btn-run-production-audit"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-xs font-bold uppercase tracking-wider px-5 py-3 rounded transition-all outline-none cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Auditing...' : 'Run Integrity Audit'}
        </button>
      </div>

      {!report && !isRunning && (
        <div className="border border-white/10 rounded bg-[#0d0e11] p-12 text-center max-w-xl mx-auto mt-8">
          <ShieldAlert className="w-12 h-12 text-white/50 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-white/90">No report generated yet</h3>
          <p className="text-xs text-white/60 mt-1 max-w-sm mx-auto leading-relaxed">
            Click &ldquo;Run Integrity Audit&rdquo; above to catalog potential data integrity issues, mismatched references, or orphaned assets.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-6 animate-fade-in">
          {/* READY FOR MIGRATION BANNER */}
          {report.summary.errorCount === 0 && report.summary.migratedGalleryEntries > 0 && (
            <div className="flex items-start gap-3 bg-emerald-950/20 border border-emerald-500/30 rounded p-4 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">Ready for Migration</h4>
                <p className="text-[11px] text-white/90 mt-1">
                  All structural integrity checks passed successfully! Mapped/promoted gallery entries were identified and verified. Safe to proceed with database upgrades.
                </p>
              </div>
            </div>
          )}

          {/* MIGRATION METRICS OVERVIEW */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Production Pages', value: report.summary.totalProductionPages },
              { label: 'Image Versions', value: report.summary.totalImageVersions },
              { label: 'Gallery Entries', value: report.summary.totalComicGalleryEntries },
              { label: 'Promoted Issues', value: report.summary.promotedIssueCount },
              { label: 'Migrated Gallery', value: report.summary.migratedGalleryEntries, high: report.summary.migratedGalleryEntries > 0 },
              { label: 'Orphaned Gallery', value: report.summary.orphanedGalleryEntries, warn: report.summary.orphanedGalleryEntries > 0 }
            ].map((metric, i) => (
              <div 
                key={i} 
                className="bg-[#0f1115] border border-white/5 rounded px-3 py-2.5 transition-all hover:border-white/10"
              >
                <div className="text-[10px] uppercase font-bold text-white/50 tracking-wider truncate">
                  {metric.label}
                </div>
                <div className={`text-lg font-black mt-1 ${
                  metric.high ? 'text-emerald-400' : metric.warn ? 'text-amber-400' : 'text-white'
                }`}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          {/* STATUS GRID (ERRORS vs WARNINGS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 rounded bg-red-950/15 border border-red-500/10">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-100">Critical Errors</span>
              </div>
              <span className="text-xl font-mono font-black text-red-400">
                {report.summary.errorCount}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded bg-amber-950/15 border border-amber-500/10">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-100">Warnings</span>
              </div>
              <span className="text-xl font-mono font-black text-amber-400">
                {report.summary.warningCount}
              </span>
            </div>
          </div>

          {/* MIGRATION WORKFLOW PANEL */}
          {report.summary.totalComicGalleryEntries > 0 && (
            <div className="bg-[#0f1115] border border-white/10 rounded p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">
                  Step-by-Step Comic Gallery Migration
                </h3>
              </div>
              <p className="text-xs text-white/70 max-w-3xl leading-relaxed">
                Convert old record-based gallery entries mapped by beat sequence descriptors into modern, unified ImageVersions assigned directly to ProductionPages.
              </p>

              {report.summary.errorCount > 0 ? (
                <div className="bg-red-950/10 border border-red-500/20 rounded p-3 text-xs text-red-300">
                  ⚠️ Migration is blocked. You must resolve all critical errors before running the migration.
                </div>
              ) : (
                <div className="space-y-4">
                  {!migrationResult ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded bg-amber-950/10 border border-amber-500/10">
                      <div>
                        <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Ready to Migrate
                        </div>
                        <p className="text-[11px] text-white/80 mt-1">
                          Audit passed with 0 errors. Ready to migrate <strong>{report.summary.totalComicGalleryEntries}</strong> legacy gallery entries.
                        </p>
                      </div>
                      <button
                        onClick={handleMigrate}
                        disabled={isMigrating}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded transition-all outline-none cursor-pointer whitespace-nowrap shrink-0 animate-pulse"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isMigrating ? 'Migrating...' : 'Migrate to ImageVersions'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Step 3: Confirm Clear after Migrate result */}
                      <div className="p-4 rounded bg-emerald-950/15 border border-emerald-500/20 space-y-3">
                        <div>
                          <div className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
                            Migration Output Verified
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 py-1 select-none">
                            <div className="bg-[#0c0d10] px-3 py-2 rounded border border-white/5">
                              <span className="text-[10px] text-white/50 block font-bold uppercase tracking-wide">Migrated</span>
                              <span className="text-lg font-black font-mono text-emerald-400">{migrationResult.migrated}</span>
                            </div>
                            <div className="bg-[#0c0d10] px-3 py-2 rounded border border-white/5">
                              <span className="text-[10px] text-white/50 block font-bold uppercase tracking-wide">Recovered</span>
                              <span className="text-lg font-black font-mono text-amber-400">{migrationResult.recovered}</span>
                            </div>
                            <div className="bg-[#0c0d10] px-3 py-2 rounded border border-white/5">
                              <span className="text-[10px] text-white/50 block font-bold uppercase tracking-wide">Failed</span>
                              <span className="text-lg font-black font-mono text-red-400">{migrationResult.failed}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/10">
                          <p className="text-[11px] text-white/70 max-w-xl leading-relaxed">
                            To complete the migration, you must now confirm clearing the legacy <code>comicGallery</code> field. This is the third and final step of the layout upgrade sequence.
                          </p>
                          <button
                            onClick={handleClearAfterConfirm}
                            disabled={isClearing}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded transition-all outline-none cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {isClearing ? 'Clearing...' : 'Confirm — Clear comicGallery'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AUDIT DETAILS PANEL */}
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-widest font-black text-white/60">
              Details By Category
            </h3>

            {report.issues.length === 0 ? (
              <div className="bg-emerald-950/10 border border-emerald-500/10 rounded p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-emerald-300">Clean Bill of Health</p>
                <p className="text-[10px] text-white/65 mt-1">
                  Zero critical errors or warnings detected in this show&rsquo;s production schema.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allCategories.map(cat => {
                  const items = issuesByCategory[cat] ?? [];
                  const isExpanded = expandedCategories[cat] !== false;
                  return (
                    <div 
                      key={cat} 
                      className="border border-white/10 rounded overflow-hidden bg-[#0d0e11]"
                    >
                      {/* Accordion Trigger Header */}
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center justify-between p-3 bg-[#13151a] hover:bg-[#1a1d24] transition-colors select-none text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {cat}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-[#1d222b] text-white/70 px-1.5 py-0.5 rounded-full">
                            {items.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-white/60" />
                        ) : (
                          <ChevronRight size={16} className="text-white/60" />
                        )}
                      </button>

                      {/* Expandable Issues Body */}
                      {isExpanded && (
                        <div className="divide-y divide-white/5 bg-black/20">
                          {items.map((iss, index) => {
                            let severityColor = 'text-white/60';
                            let bgColor = 'bg-black/10';
                            let badgeStyle = 'bg-white/10 text-white/90 border-white/20';

                            if (iss.severity === 'error') {
                              severityColor = 'text-red-400';
                              bgColor = 'bg-red-950/10';
                              badgeStyle = 'bg-red-500/10 text-red-400 border-red-500/30';
                            } else if (iss.severity === 'warning') {
                              severityColor = 'text-amber-400';
                              bgColor = 'bg-amber-950/10';
                              badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                            }

                            return (
                              <div 
                                key={index} 
                                className={`p-3 flex flex-col md:flex-row gap-3 items-start justify-between ${bgColor}`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center flex-wrap gap-2 text-[10px]">
                                    <span className={`px-2 py-0.5 rounded-sm font-black uppercase text-[9px] border ${badgeStyle}`}>
                                      {iss.severity}
                                    </span>
                                    <span className="text-white/50 font-mono">
                                      {iss.uid ? `UID: ${iss.uid}` : 'Global Context'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-white/90 font-medium leading-relaxed mt-1">
                                    {iss.description}
                                  </p>
                                </div>

                                <div className="shrink-0 flex items-center justify-end text-[10px]">
                                  {iss.recoverable ? (
                                    <span className="text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded bg-opacity-10 font-bold uppercase tracking-wider">
                                      Auto-Repairable
                                    </span>
                                  ) : (
                                    <span className="text-white/60 border border-white/10 bg-white/5 px-2 py-0.5 rounded bg-opacity-5 font-bold uppercase tracking-wider">
                                      Manual Intervention
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
