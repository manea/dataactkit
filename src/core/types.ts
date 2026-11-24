export type DataActRole =
  | 'cloud-customer'
  | 'cloud-provider'
  | 'iot-connected-provider'
  | 'dual-iot-and-cloud';

export type ControlScope =
  | 'iot-design'
  | 'switching-contract'
  | 'egress-fees'
  | 'interoperability'
  | 'exit-governance';

export type ReadinessStatus = 'ready' | 'conditional' | 'blocked';

export type RuleSeverity = 'blocker' | 'warning' | 'info';

export type DataActControlId =
  | 'DA-ART3-01'
  | 'DA-ART3-02'
  | 'DA-ART25-01'
  | 'DA-ART26-01'
  | 'DA-ART28-01'
  | 'DA-ART29-01'
  | 'DA-ART30-01';

export interface ControlDefinition {
  id: DataActControlId;
  article: string;
  scope: ControlScope;
  effectiveFrom: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  evidenceHintEn: string;
  evidenceHintAr: string;
}

export interface AuditFinding {
  code: string;
  severity: RuleSeverity;
  article: string;
  messageEn: string;
  messageAr: string;
}

export interface SwitchingClockInput {
  switchRequestDate: string;
  quotedNoticeDays: number;
  quotedTransitionDays: number;
  technicalInfeasibilityClaimed: boolean;
  infeasibilityNoticeWorkingDays: number | null;
  infeasibilityReason: string;
  quotedRetrievalDays: number;
}

export interface SwitchingClockResult {
  normalizedRequestDate: string;
  maxLegalNoticeEndDate: string;
  maxLegalNoticeDays: number;
  noticeEndDate: string;
  noticeCompliant: boolean;
  infeasibilityNoticeDeadlineDate: string;
  infeasibilityNoticeCompliant: boolean;
  maxAllowedTransitionDays: number;
  transitionDeadlineDate: string;
  transitionCompliant: boolean;
  minRequiredRetrievalDays: number;
  retrievalDeadlineDate: string;
  retrievalCompliant: boolean;
  status: ReadinessStatus;
  findings: AuditFinding[];
}

export interface EgressFeeInput {
  switchRequestDate: string;
  dataVolumeTb: number;
  egressFeePerGbEur: number;
  exitAdminFeeEur: number;
  directTechnicalCostEur: number;
  parallelProcessingAgreed?: boolean;
}

export type EgressFeePhase = 'pre-2027-direct-cost-cap' | 'post-2027-zero-charge-ban';

export interface EgressFeeResult {
  cutoffDate: string;
  phase: EgressFeePhase;
  isZeroChargeBanActive: boolean;
  quotedEgressFeeEur: number;
  exitAdminFeeEur: number;
  totalQuotedSwitchingEur: number;
  maxLegalChargeEur: number;
  illegalOverchargeEur: number;
  compliant: boolean;
  status: ReadinessStatus;
  findings: AuditFinding[];
}

export interface VendorCsvRowResult {
  rowNumber: number;
  vendorName: string;
  serviceCategory: string;
  switchRequestDate: string;
  status: ReadinessStatus;
  totalQuotedSwitchingEur: number;
  maxLegalChargeEur: number;
  illegalOverchargeEur: number;
  noticeCompliant: boolean;
  transitionCompliant: boolean;
  retrievalCompliant: boolean;
  findings: AuditFinding[];
}

export interface CsvBatchAuditResult {
  totalVendors: number;
  readyCount: number;
  conditionalCount: number;
  blockedCount: number;
  parseWarnings: string[];
  totalQuotedSwitchingEur: number;
  totalIllegalOverchargeEur: number;
  vendors: VendorCsvRowResult[];
  safeExportCsv: string;
}

export interface ControlEvaluation {
  definition: ControlDefinition;
  applicable: boolean;
  implemented: boolean;
  reasonEn: string;
  reasonAr: string;
}

export interface AssessmentInput {
  organizationName: string;
  vendorOrProductName: string;
  role: DataActRole;
  assessmentDate: string;
  clock: SwitchingClockInput;
  egress: EgressFeeInput;
  implementedControls: readonly DataActControlId[];
  vendorCsv?: string;
  notes?: string;
}

export interface AssessmentResult {
  regulation: string;
  disclaimerEn: string;
  disclaimerAr: string;
  organizationName: string;
  vendorOrProductName: string;
  role: DataActRole;
  assessmentDate: string;
  iotAccessByDesignActive: boolean;
  egressZeroChargeActive: boolean;
  status: ReadinessStatus;
  readinessScore: number;
  switchingClock: SwitchingClockResult;
  egressFee: EgressFeeResult;
  controls: ControlEvaluation[];
  applicableControlsCount: number;
  implementedApplicableCount: number;
  missingControls: DataActControlId[];
  batchAudit: CsvBatchAuditResult | null;
  findings: AuditFinding[];
  canonicalDossierText: string;
  dossierSha256: string;
}

export type DataActPresetId =
  | 'eu-saas-zero-egress-2027-ready'
  | 'pre-2027-transition-infeasibility-conditional'
  | 'post-2027-egress-lockin-blocked';

export interface DataActPreset {
  id: DataActPresetId;
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  expectedStatus: ReadinessStatus;
  input: AssessmentInput;
}
