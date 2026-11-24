import { auditVendorCsv } from './csvVendorAuditor.ts';
import {
  DISCLAIMER_AR,
  DISCLAIMER_EN,
  EU_DATA_ACT_REGULATION,
  IOT_ACCESS_BY_DESIGN_DATE,
  evaluateControls,
} from './dataActCatalog.ts';
import { buildCanonicalDossierText, computePayloadDigest } from './dossierDigest.ts';
import { evaluateEgressFee } from './egressFeeEngine.ts';
import { formatIsoDateUtc, parseIsoDateUtc, evaluateSwitchingClock } from './switchingClockEngine.ts';
import type {
  AssessmentInput,
  AssessmentResult,
  AuditFinding,
  DataActControlId,
  ReadinessStatus,
} from './types.ts';

export async function assessDataActReadiness(input: AssessmentInput): Promise<AssessmentResult> {
  if (!input.organizationName.trim()) {
    throw new Error('organizationName is required.');
  }
  if (!input.vendorOrProductName.trim()) {
    throw new Error('vendorOrProductName is required.');
  }
  const assessmentDate = formatIsoDateUtc(parseIsoDateUtc(input.assessmentDate));

  const switchingClock = evaluateSwitchingClock(input.clock);
  const egressFee = evaluateEgressFee(input.egress);
  const controls = evaluateControls(
    input.role,
    assessmentDate,
    switchingClock.normalizedRequestDate,
    input.implementedControls,
  );

  const batchAudit =
    input.vendorCsv && input.vendorCsv.trim().length > 0 ? auditVendorCsv(input.vendorCsv) : null;

  const applicableControls = controls.filter((c) => c.applicable);
  const implementedApplicableCount = applicableControls.filter((c) => c.implemented).length;
  const missingControls: DataActControlId[] = applicableControls
    .filter((c) => !c.implemented)
    .map((c) => c.definition.id);

  const findings: AuditFinding[] = [...switchingClock.findings, ...egressFee.findings];

  for (const ctrl of applicableControls) {
    if (!ctrl.implemented) {
      findings.push({
        code: `DA-CTRL-MISSING-${ctrl.definition.id}`,
        severity: 'warning',
        article: ctrl.definition.article,
        messageEn: `${ctrl.definition.id}: ${ctrl.reasonEn}`,
        messageAr: `${ctrl.definition.id}: ${ctrl.reasonAr}`,
      });
    }
  }

  if (batchAudit) {
    if (batchAudit.parseWarnings.length > 0) {
      findings.push({
        code: 'DA-CSV-PARSE-WARNINGS',
        severity: 'warning',
        article: 'Batch Audit',
        messageEn: `${batchAudit.parseWarnings.length} CSV vendor row(s) skipped due to formatting errors.`,
        messageAr: `تم تخطي ${batchAudit.parseWarnings.length} صفاً في ملف CSV بسبب أخطاء تنسيق.`,
      });
    }
    if (batchAudit.blockedCount > 0) {
      findings.push({
        code: 'DA-CSV-BLOCKED-VENDORS',
        severity: 'blocker',
        article: 'Art. 25 & 29',
        messageEn: `Batch vendor audit flagged ${batchAudit.blockedCount} blocked vendor(s) with EUR ${batchAudit.totalIllegalOverchargeEur} total excess charges.`,
        messageAr: `كشف تدقيق البائعين الجماعي عن ${batchAudit.blockedCount} بائعاً محجوباً بإجمالي تجاوز رسوم قدره ${batchAudit.totalIllegalOverchargeEur} يورو.`,
      });
    } else if (batchAudit.conditionalCount > 0) {
      findings.push({
        code: 'DA-CSV-CONDITIONAL-VENDORS',
        severity: 'warning',
        article: 'Art. 25',
        messageEn: `Batch vendor audit flagged ${batchAudit.conditionalCount} vendor(s) using conditional switching exceptions.`,
        messageAr: `كشف تدقيق البائعين الجماعي عن ${batchAudit.conditionalCount} بائعاً بحالة مشروطة.`,
      });
    }
  }

  let status: ReadinessStatus = 'ready';
  if (findings.some((f) => f.severity === 'blocker')) {
    status = 'blocked';
  } else if (findings.some((f) => f.severity === 'warning')) {
    status = 'conditional';
  }

  // Transparent 0–100 deterministic readiness weighting:
  // Clock (25) + Egress Fee (25) + Applicable Controls (40) + Batch CSV Hygiene (10)
  let clockScore = 0;
  if (switchingClock.noticeCompliant) clockScore += 8;
  if (switchingClock.transitionCompliant && switchingClock.infeasibilityNoticeCompliant) {
    clockScore += switchingClock.status === 'ready' ? 9 : 4;
  }
  if (switchingClock.retrievalCompliant) clockScore += 8;

  const egressScore = egressFee.compliant ? 25 : 0;
  const controlScore =
    applicableControls.length === 0
      ? 40
      : Math.round((implementedApplicableCount / applicableControls.length) * 40);

  let batchScore = 10;
  if (batchAudit) {
    if (batchAudit.blockedCount > 0) batchScore = 0;
    else if (batchAudit.conditionalCount > 0 || batchAudit.parseWarnings.length > 0) batchScore = 6;
  }

  const readinessScore = Math.max(0, Math.min(100, clockScore + egressScore + controlScore + batchScore));

  const canonicalDossierText = buildCanonicalDossierText({
    input: { ...input, assessmentDate },
    status,
    readinessScore,
    switchingClock,
    egressFee,
    missingControls,
    batchAudit,
  });

  const dossierSha256 = await computePayloadDigest(canonicalDossierText);

  return {
    regulation: EU_DATA_ACT_REGULATION,
    disclaimerEn: DISCLAIMER_EN,
    disclaimerAr: DISCLAIMER_AR,
    organizationName: input.organizationName.trim(),
    vendorOrProductName: input.vendorOrProductName.trim(),
    role: input.role,
    assessmentDate,
    iotAccessByDesignActive: assessmentDate >= IOT_ACCESS_BY_DESIGN_DATE,
    egressZeroChargeActive: egressFee.isZeroChargeBanActive,
    status,
    readinessScore,
    switchingClock,
    egressFee,
    controls,
    applicableControlsCount: applicableControls.length,
    implementedApplicableCount,
    missingControls,
    batchAudit,
    findings,
    canonicalDossierText,
    dossierSha256,
  };
}
