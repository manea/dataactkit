import { EGRESS_ZERO_CHARGE_DATE } from './dataActCatalog.ts';
import { formatIsoDateUtc, parseIsoDateUtc } from './switchingClockEngine.ts';
import type { AuditFinding, EgressFeeInput, EgressFeeResult, ReadinessStatus } from './types.ts';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function evaluateEgressFee(input: EgressFeeInput): EgressFeeResult {
  const normalizedDate = formatIsoDateUtc(parseIsoDateUtc(input.switchRequestDate));
  const numericFields = [
    input.dataVolumeTb,
    input.egressFeePerGbEur,
    input.exitAdminFeeEur,
    input.directTechnicalCostEur,
  ];
  if (numericFields.some((v) => !Number.isFinite(v) || v < 0)) {
    throw new Error('Egress fee inputs (dataVolumeTb, egressFeePerGbEur, exitAdminFeeEur, directTechnicalCostEur) must be finite non-negative numbers.');
  }

  const quotedEgressFeeEur = round2(input.dataVolumeTb * 1024 * input.egressFeePerGbEur);
  const exitAdminFeeEur = round2(input.exitAdminFeeEur);
  const totalQuotedSwitchingEur = round2(quotedEgressFeeEur + exitAdminFeeEur);

  const isZeroChargeBanActive = normalizedDate >= EGRESS_ZERO_CHARGE_DATE;
  const phase = isZeroChargeBanActive ? 'post-2027-zero-charge-ban' : 'pre-2027-direct-cost-cap';
  const maxLegalChargeEur = isZeroChargeBanActive ? 0 : round2(input.directTechnicalCostEur);
  const illegalOverchargeEur = round2(Math.max(0, totalQuotedSwitchingEur - maxLegalChargeEur));
  const compliant = illegalOverchargeEur === 0;

  const findings: AuditFinding[] = [];

  if (!compliant) {
    findings.push({
      code: 'DA-FEE-ILLEGAL-OVERCHARGE',
      severity: 'blocker',
      article: 'Art. 29',
      messageEn: isZeroChargeBanActive
        ? `Quoted switching/egress charges of EUR ${totalQuotedSwitchingEur} violate the mandatory EUR 0 ban effective ${EGRESS_ZERO_CHARGE_DATE} (illegal overcharge: EUR ${illegalOverchargeEur}).`
        : `Quoted switching/egress charges of EUR ${totalQuotedSwitchingEur} exceed verified direct technical switching costs of EUR ${maxLegalChargeEur} prior to ${EGRESS_ZERO_CHARGE_DATE} (overcharge: EUR ${illegalOverchargeEur}).`,
      messageAr: isZeroChargeBanActive
        ? `الرسوم المطلوبة للتبديل والخروج (${totalQuotedSwitchingEur} يورو) تخالف حظر الـ 0 يورو الإلزامي الساري من ${EGRESS_ZERO_CHARGE_DATE} (تجاوز غير قانوني: ${illegalOverchargeEur} يورو).`
        : `الرسوم المطلوبة (${totalQuotedSwitchingEur} يورو) تتجاوز سقف التكلفة التقنية المباشرة المثبتة (${maxLegalChargeEur} يورو) قبل ${EGRESS_ZERO_CHARGE_DATE} (تجاوز: ${illegalOverchargeEur} يورو).`,
    });
  } else if (!isZeroChargeBanActive && totalQuotedSwitchingEur > 0) {
    findings.push({
      code: 'DA-FEE-PRE2027-COST-CAP-ACTIVE',
      severity: 'info',
      article: 'Art. 29(2)',
      messageEn: `Pre-2027 switching fee (EUR ${totalQuotedSwitchingEur}) sits within verified direct technical cost ceiling (EUR ${maxLegalChargeEur}); all switching/egress charges must drop to EUR 0 on ${EGRESS_ZERO_CHARGE_DATE}.`,
      messageAr: `رسوم الانتقال قبل 2027 (${totalQuotedSwitchingEur} يورو) تقع ضمن سقف التكلفة المباشرة (${maxLegalChargeEur} يورو)، ويجب أن تنخفض إلى 0 يورو نهائياً في ${EGRESS_ZERO_CHARGE_DATE}.`,
    });
  }

  if (input.parallelProcessingAgreed && isZeroChargeBanActive) {
    findings.push({
      code: 'DA-FEE-PARALLEL-COST-BASIS',
      severity: 'info',
      article: 'Art. 29(4)',
      messageEn: 'Customer-agreed in-situ parallel processing charges must remain strictly limited to direct incurred provider costs.',
      messageAr: 'رسوم المعالجة المتوازية المتفق عليها صراحةً تبقى محصورة في التكاليف الفعلية المباشرة فقط.',
    });
  }

  const status: ReadinessStatus = findings.some((f) => f.severity === 'blocker')
    ? 'blocked'
    : findings.some((f) => f.severity === 'warning')
      ? 'conditional'
      : 'ready';

  return {
    cutoffDate: EGRESS_ZERO_CHARGE_DATE,
    phase,
    isZeroChargeBanActive,
    quotedEgressFeeEur,
    exitAdminFeeEur,
    totalQuotedSwitchingEur,
    maxLegalChargeEur,
    illegalOverchargeEur,
    compliant,
    status,
    findings,
  };
}
