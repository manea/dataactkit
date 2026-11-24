import { describe, expect, it } from 'vitest';
import {
  DATA_ACT_PRESETS,
  EGRESS_ZERO_CHARGE_DATE,
  IOT_ACCESS_BY_DESIGN_DATE,
  addWorkingDaysUtc,
  assessDataActReadiness,
  auditVendorCsv,
  computePayloadDigest,
  evaluateEgressFee,
  evaluateSwitchingClock,
  getDataActPreset,
  sanitizeCsvCell,
} from '../../src/core/index.ts';

describe('1. EU Data Act Switching Clock Engine (Art. 25)', () => {
  it('computes 14 UTC working days accurately across weekends and enforces standard 30d transition', () => {
    // 2026-11-16 is a Monday -> +14 Mon-Fri working days = 2026-12-04 (Friday)
    expect(addWorkingDaysUtc('2026-11-16', 14)).toBe('2026-12-04');
    // Starting on Friday 2026-11-13 -> +1 working day skips Sat/Sun to Monday 2026-11-16
    expect(addWorkingDaysUtc('2026-11-13', 1)).toBe('2026-11-16');

    const compliant = evaluateSwitchingClock({
      switchRequestDate: '2027-02-01',
      quotedNoticeDays: 60,
      quotedTransitionDays: 30,
      technicalInfeasibilityClaimed: false,
      infeasibilityNoticeWorkingDays: null,
      infeasibilityReason: '',
      quotedRetrievalDays: 30,
    });
    expect(compliant.status).toBe('ready');
    expect(compliant.noticeCompliant).toBe(true);
    expect(compliant.transitionCompliant).toBe(true);
    expect(compliant.retrievalCompliant).toBe(true);
    expect(compliant.infeasibilityNoticeDeadlineDate).toBe('2027-02-19');
  });

  it('blocks transitions > 30d without valid <= 14 working-day infeasibility notice, > 210d cap, or retrieval < 30d', () => {
    const lateNotice = evaluateSwitchingClock({
      switchRequestDate: '2026-11-16',
      quotedNoticeDays: 30,
      quotedTransitionDays: 120,
      technicalInfeasibilityClaimed: true,
      infeasibilityNoticeWorkingDays: 15,
      infeasibilityReason: 'Complex multi-region database topology migration',
      quotedRetrievalDays: 30,
    });
    expect(lateNotice.status).toBe('blocked');
    expect(lateNotice.infeasibilityNoticeCompliant).toBe(false);
    expect(lateNotice.transitionCompliant).toBe(false);

    const overSevenMonths = evaluateSwitchingClock({
      switchRequestDate: '2026-11-16',
      quotedNoticeDays: 30,
      quotedTransitionDays: 215,
      technicalInfeasibilityClaimed: true,
      infeasibilityNoticeWorkingDays: 7,
      infeasibilityReason: 'Large archival petabyte synchronization across sovereign clusters',
      quotedRetrievalDays: 15,
    });
    expect(overSevenMonths.status).toBe('blocked');
    expect(overSevenMonths.transitionCompliant).toBe(false);
    expect(overSevenMonths.retrievalCompliant).toBe(false);
  });
});

describe('2. Switching & Egress Fee Engine (Art. 29 & 2027-01-12 Zero-Charge Cutoff)', () => {
  it('enforces direct technical cost cap before 2027-01-12 and strict EUR 0 ban from 2027-01-12', () => {
    const preCutoffCompliant = evaluateEgressFee({
      switchRequestDate: '2027-01-11',
      dataVolumeTb: 10,
      egressFeePerGbEur: 0.05, // 10 * 1024 * 0.05 = 512 EUR
      exitAdminFeeEur: 88,
      directTechnicalCostEur: 600,
    });
    expect(preCutoffCompliant.phase).toBe('pre-2027-direct-cost-cap');
    expect(preCutoffCompliant.isZeroChargeBanActive).toBe(false);
    expect(preCutoffCompliant.totalQuotedSwitchingEur).toBe(600);
    expect(preCutoffCompliant.illegalOverchargeEur).toBe(0);
    expect(preCutoffCompliant.status).toBe('ready');

    const onCutoffDayBanned = evaluateEgressFee({
      switchRequestDate: EGRESS_ZERO_CHARGE_DATE, // '2027-01-12'
      dataVolumeTb: 10,
      egressFeePerGbEur: 0.05,
      exitAdminFeeEur: 88,
      directTechnicalCostEur: 600,
    });
    expect(onCutoffDayBanned.phase).toBe('post-2027-zero-charge-ban');
    expect(onCutoffDayBanned.isZeroChargeBanActive).toBe(true);
    expect(onCutoffDayBanned.maxLegalChargeEur).toBe(0);
    expect(onCutoffDayBanned.illegalOverchargeEur).toBe(600);
    expect(onCutoffDayBanned.status).toBe('blocked');
  });

  it('computes exact EUR 7,108 illegal post-2027 egress + admin overcharge for 80 TB scenario', () => {
    const res = evaluateEgressFee({
      switchRequestDate: '2027-02-01',
      dataVolumeTb: 80,
      egressFeePerGbEur: 0.08, // 80 * 1024 * 0.08 = 6553.6
      exitAdminFeeEur: 554.4, // 6553.6 + 554.4 = 7108
      directTechnicalCostEur: 4000,
    });
    expect(res.quotedEgressFeeEur).toBe(6553.6);
    expect(res.totalQuotedSwitchingEur).toBe(7108);
    expect(res.maxLegalChargeEur).toBe(0);
    expect(res.illegalOverchargeEur).toBe(7108);
    expect(res.status).toBe('blocked');
  });
});

describe('3. IoT Access-by-Design (2026-09-12) & Multi-Vendor CSV Batch Auditor', () => {
  it('activates Art. 3 IoT connected-product controls on 2026-09-12 boundary', async () => {
    const baseInput = {
      organizationName: 'SmartMeter Co',
      vendorOrProductName: 'GridSense Hub v4',
      role: 'iot-connected-provider' as const,
      assessmentDate: '2026-09-11',
      clock: {
        switchRequestDate: '2026-09-11',
        quotedNoticeDays: 30,
        quotedTransitionDays: 30,
        technicalInfeasibilityClaimed: false,
        infeasibilityNoticeWorkingDays: null,
        infeasibilityReason: '',
        quotedRetrievalDays: 30,
      },
      egress: {
        switchRequestDate: '2026-09-11',
        dataVolumeTb: 0,
        egressFeePerGbEur: 0,
        exitAdminFeeEur: 0,
        directTechnicalCostEur: 0,
      },
      implementedControls: [] as const,
    };

    const dayBefore = await assessDataActReadiness(baseInput);
    expect(dayBefore.iotAccessByDesignActive).toBe(false);
    expect(dayBefore.applicableControlsCount).toBe(0);
    expect(dayBefore.status).toBe('ready');

    const dayOnEffective = await assessDataActReadiness({
      ...baseInput,
      assessmentDate: IOT_ACCESS_BY_DESIGN_DATE, // '2026-09-12'
    });
    expect(dayOnEffective.iotAccessByDesignActive).toBe(true);
    expect(dayOnEffective.applicableControlsCount).toBe(2);
    expect(dayOnEffective.missingControls).toEqual(['DA-ART3-01', 'DA-ART3-02']);
    expect(dayOnEffective.status).toBe('conditional');
  });

  it('audits semicolon/comma CSVs and neutralizes spreadsheet formula injection with UTF-8 BOM', () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://x","pwn")')).toBe('"\'=HYPERLINK(""http://x"",""pwn"")"');
    expect(sanitizeCsvCell('+cmd|"/c calc"')).toBe('"\'+cmd|""/c calc"""');
    expect(sanitizeCsvCell('@SUM(A1:A9)')).toBe('"\'@SUM(A1:A9)"');
    expect(sanitizeCsvCell(' -2+3')).toBe('"\' -2+3"');

    const csv = [
      'vendorName;serviceCategory;switchRequestDate;noticeDays;transitionDays;retrievalDays;dataVolumeTb;egressFeePerGbEur;exitAdminFeeEur;directTechnicalCostEur',
      '=EVIL_VENDOR();Cloud;2027-02-01;90;30;30;10;0.10;50;0',
      'CleanCloud EU;SaaS;2027-02-01;30;30;30;5;0;0;0',
    ].join('\n');

    const batch = auditVendorCsv(csv);
    expect(batch.totalVendors).toBe(2);
    expect(batch.blockedCount).toBe(1);
    expect(batch.readyCount).toBe(1);
    expect(batch.totalIllegalOverchargeEur).toBe(1074); // 10 * 1024 * 0.10 + 50 = 1074
    expect(batch.safeExportCsv.startsWith('\uFEFFvendorName,')).toBe(true);
    expect(batch.safeExportCsv).toContain('"\'=EVIL_VENDOR()"');
  });
});

describe('4. Presets, Canonical SHA-256 Dossier & Non-Legal-Counsel Disclaimer', () => {
  it('evaluates all three DATA_ACT_PRESETS deterministically and produces stable SHA-256 digests', async () => {
    expect(DATA_ACT_PRESETS).toHaveLength(3);

    const readyRes = await assessDataActReadiness(getDataActPreset('eu-saas-zero-egress-2027-ready').input);
    expect(readyRes.status).toBe('ready');
    expect(readyRes.readinessScore).toBe(100);
    expect(readyRes.egressFee.illegalOverchargeEur).toBe(0);
    expect(readyRes.egressZeroChargeActive).toBe(true);
    expect(readyRes.batchAudit?.blockedCount).toBe(0);

    const condRes = await assessDataActReadiness(
      getDataActPreset('pre-2027-transition-infeasibility-conditional').input,
    );
    expect(condRes.status).toBe('conditional');
    expect(condRes.iotAccessByDesignActive).toBe(true);
    expect(condRes.egressZeroChargeActive).toBe(false);
    expect(condRes.egressFee.illegalOverchargeEur).toBe(0);
    expect(condRes.switchingClock.infeasibilityNoticeCompliant).toBe(true);
    expect(condRes.missingControls).toContain('DA-ART28-01');

    const blockedRes = await assessDataActReadiness(getDataActPreset('post-2027-egress-lockin-blocked').input);
    expect(blockedRes.status).toBe('blocked');
    expect(blockedRes.egressZeroChargeActive).toBe(true);
    expect(blockedRes.egressFee.illegalOverchargeEur).toBe(7108);
    expect(blockedRes.switchingClock.status).toBe('blocked');
    expect(blockedRes.batchAudit?.blockedCount).toBe(1);

    // Deterministic SHA-256 and mandatory non-legal disclaimer check
    expect(readyRes.dossierSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await computePayloadDigest(readyRes.canonicalDossierText)).toBe(readyRes.dossierSha256);
    expect(readyRes.disclaimerEn).toContain('NOT legal counsel');
    expect(readyRes.disclaimerAr).toContain('ليست استشارة قانونية');
  });
});
