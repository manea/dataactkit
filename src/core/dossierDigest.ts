import { EU_DATA_ACT_REGULATION } from './dataActCatalog.ts';
import type {
  AssessmentInput,
  CsvBatchAuditResult,
  DataActControlId,
  EgressFeeResult,
  ReadinessStatus,
  SwitchingClockResult,
} from './types.ts';

export interface CanonicalDossierInput {
  input: AssessmentInput;
  status: ReadinessStatus;
  readinessScore: number;
  switchingClock: SwitchingClockResult;
  egressFee: EgressFeeResult;
  missingControls: DataActControlId[];
  batchAudit: CsvBatchAuditResult | null;
}

export function buildCanonicalDossierText(params: CanonicalDossierInput): string {
  const { input, status, readinessScore, switchingClock, egressFee, missingControls, batchAudit } =
    params;

  const lines: string[] = [
    `regulation=${EU_DATA_ACT_REGULATION}`,
    `organization=${input.organizationName.trim()}`,
    `vendorOrProduct=${input.vendorOrProductName.trim()}`,
    `role=${input.role}`,
    `assessmentDate=${input.assessmentDate}`,
    `overallStatus=${status}`,
    `readinessScore=${readinessScore}`,
    `switchRequestDate=${switchingClock.normalizedRequestDate}`,
    `noticeEndDate=${switchingClock.noticeEndDate}`,
    `noticeCompliant=${switchingClock.noticeCompliant}`,
    `transitionDeadlineDate=${switchingClock.transitionDeadlineDate}`,
    `transitionCompliant=${switchingClock.transitionCompliant}`,
    `retrievalDeadlineDate=${switchingClock.retrievalDeadlineDate}`,
    `retrievalCompliant=${switchingClock.retrievalCompliant}`,
    `egressPhase=${egressFee.phase}`,
    `totalQuotedSwitchingEur=${egressFee.totalQuotedSwitchingEur.toFixed(2)}`,
    `maxLegalChargeEur=${egressFee.maxLegalChargeEur.toFixed(2)}`,
    `illegalOverchargeEur=${egressFee.illegalOverchargeEur.toFixed(2)}`,
    `missingControls=${missingControls.slice().sort().join(',') || 'none'}`,
  ];

  if (batchAudit) {
    lines.push(
      `batchVendors=${batchAudit.totalVendors}`,
      `batchBlocked=${batchAudit.blockedCount}`,
      `batchIllegalOverchargeEur=${batchAudit.totalIllegalOverchargeEur.toFixed(2)}`,
    );
  }

  return lines.join('\n');
}

export async function computePayloadDigest(payload: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto subtle.digest is unavailable in the current runtime.');
  }
  const bytes = new TextEncoder().encode(payload);
  const digest = await subtle.digest('SHA-256', bytes);
  const hashBytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < hashBytes.length; i += 1) {
    hex += hashBytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
