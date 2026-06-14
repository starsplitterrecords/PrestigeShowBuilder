import React from 'react';
import { Psb4Artifact, ArtifactType } from '../types';
import { RegroundingBriefView } from './RegroundingBriefView';
import { EngineReadView } from './EngineReadView';
import { WorkingInventoryView } from './WorkingInventoryView';
import { RepetitionDiagnosisView } from './RepetitionDiagnosisView';
import { FormFunctionAuditView } from './FormFunctionAuditView';
import { CharacterFunctionAuditView } from './CharacterFunctionAuditView';
import { PremiseCashoutView } from './PremiseCashoutView';
import { KeepCutOrdersView } from './KeepCutOrdersView';
import { CleanSpineView } from './CleanSpineView';
import { ArcLadderView } from './ArcLadderView';
import { IssueDraftView } from './IssueDraftView';
import { SceneStructureView } from './SceneStructureView';
import { ScenePoolView } from './ScenePoolView';
import { OutputStateView } from './OutputStateView';
import { FinaleLockView } from './FinaleLockView';
import { ArcClosureView } from './ArcClosureView';
import { EmotionalQuestionView } from './EmotionalQuestionView';
import { PrivateWoundView } from './PrivateWoundView';
import { PageTurnMapView } from './PageTurnMapView';
import { BalancedConflictView } from './BalancedConflictView';
import { RelationshipPressureView } from './RelationshipPressureView';
import { VisualMotifView } from './VisualMotifView';
import { QuietPanelPlanView } from './QuietPanelPlanView';
import { PageRhythmView } from './PageRhythmView';
import { CallbackMapView } from './CallbackMapView';
import { EarnedLineView } from './EarnedLineView';
import { GriefInventoryView } from './GriefInventoryView';
import { MoralAftertasteView } from './MoralAftertasteView';

export type ArtifactDetailViewProps = { artifact: Psb4Artifact };

const registry: Partial<Record<ArtifactType, React.FC<ArtifactDetailViewProps>>> = {
  [ArtifactType.REGROUNDING_BRIEF]:        RegroundingBriefView,
  [ArtifactType.ENGINE_READ]:              EngineReadView,
  [ArtifactType.WORKING_INVENTORY]:        WorkingInventoryView,
  [ArtifactType.REPETITION_DIAGNOSIS]:     RepetitionDiagnosisView,
  [ArtifactType.FORM_FUNCTION_AUDIT]:      FormFunctionAuditView,
  [ArtifactType.CHARACTER_FUNCTION_AUDIT]: CharacterFunctionAuditView,
  [ArtifactType.PREMISE_CASHOUT]:          PremiseCashoutView,
  [ArtifactType.KEEP_CUT_ORDERS]:          KeepCutOrdersView,
  [ArtifactType.CLEAN_SPINE]:              CleanSpineView,
  [ArtifactType.ARC_LADDER]:              ArcLadderView,
  [ArtifactType.ISSUE_DRAFT]:              IssueDraftView,
  [ArtifactType.SCENE_STRUCTURE]:          SceneStructureView,
  [ArtifactType.SCENE_POOL_ENTRY]:         ScenePoolView,
  [ArtifactType.OUTPUT_STATE]:             OutputStateView,
  [ArtifactType.FINALE_LOCK]:              FinaleLockView,
  [ArtifactType.ARC_CLOSURE_REPORT]:       ArcClosureView,
  [ArtifactType.EMOTIONAL_QUESTION]:       EmotionalQuestionView,
  [ArtifactType.PRIVATE_WOUND]:            PrivateWoundView,
  [ArtifactType.PAGE_TURN_MAP]:            PageTurnMapView,
  [ArtifactType.BALANCED_CONFLICT]:        BalancedConflictView,
  [ArtifactType.RELATIONSHIP_PRESSURE]:    RelationshipPressureView,
  [ArtifactType.VISUAL_MOTIF]:             VisualMotifView,
  [ArtifactType.QUIET_PANEL_PLAN]:         QuietPanelPlanView,
  [ArtifactType.PAGE_RHYTHM]:              PageRhythmView,
  [ArtifactType.CALLBACK_MAP]:             CallbackMapView,
  [ArtifactType.EARNED_LINE]:              EarnedLineView,
  [ArtifactType.GRIEF_INVENTORY]:          GriefInventoryView,
  [ArtifactType.MORAL_AFTERTASTE]:         MoralAftertasteView,
};

export function registerArtifactView(type: ArtifactType, view: React.FC<ArtifactDetailViewProps>) {
  registry[type] = view;
}

export function getArtifactView(type: ArtifactType): React.FC<ArtifactDetailViewProps> | null {
  return registry[type] ?? null;
}
