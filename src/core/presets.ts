import type { DataActPreset, DataActPresetId } from './types.ts';

export const DATA_ACT_PRESETS: readonly DataActPreset[] = [
  {
    id: 'eu-saas-zero-egress-2027-ready',
    titleEn: '2027 Post-Ban Zero-Egress SaaS Migration (Ready)',
    titleAr: 'هجرة SaaS بعد حظر 2027 برسوم 0 يورو (جاهز)',
    summaryEn:
      'EU cloud customer switching post-2027-01-12 with 30-day notice, 30-day transition, 45-day retrieval, EUR 0 switching/egress charges, and all 5 cloud controls attested.',
    summaryAr:
      'عميل سحابة أوروبي ينتقل بعد 12 يناير 2027 بإشعار 30 يوماً وانتقال 30 يوماً واسترداد 45 يوماً ورسوم خروج 0 يورو وتغطية كاملة للضوابط.',
    expectedStatus: 'ready',
    input: {
      organizationName: 'NordicFlow Analytics GmbH',
      vendorOrProductName: 'EuroCloud Object & Compute',
      role: 'cloud-customer',
      assessmentDate: '2027-02-01',
      clock: {
        switchRequestDate: '2027-02-01',
        quotedNoticeDays: 30,
        quotedTransitionDays: 30,
        technicalInfeasibilityClaimed: false,
        infeasibilityNoticeWorkingDays: null,
        infeasibilityReason: '',
        quotedRetrievalDays: 45,
      },
      egress: {
        switchRequestDate: '2027-02-01',
        dataVolumeTb: 25,
        egressFeePerGbEur: 0,
        exitAdminFeeEur: 0,
        directTechnicalCostEur: 0,
      },
      implementedControls: [
        'DA-ART25-01',
        'DA-ART26-01',
        'DA-ART28-01',
        'DA-ART29-01',
        'DA-ART30-01',
      ],
      vendorCsv: [
        'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur',
        'EuroCloud Object & Compute,IaaS Storage,2027-02-01,30,30,,false,45,25,0,0,0',
        'OpenTelemetry EU Cloud,SaaS Analytics,2027-02-10,45,21,,false,30,12,0,0,0',
      ].join('\n'),
    },
  },
  {
    id: 'pre-2027-transition-infeasibility-conditional',
    titleEn: 'Pre-2027 Dual IoT & Cloud Extended Transition (Conditional)',
    titleAr: 'انتقال مزدوج IoT وسحابة قبل 2027 بتمديد مبرر (مشروط)',
    summaryEn:
      'Dual IoT + cloud operator in Nov 2026: Art. 3 access-by-design active (>= 2026-09-12), justified 150-day transition notified in 10 working days, direct technical cost capped accurately at EUR 1,843.20, missing Art. 28 equivalence evidence.',
    summaryAr:
      'مشغّل IoT وسحابة في نوفمبر 2026: تفعيل المادة 3 (>= 2026-09-12)، تمديد انتقال 150 يوماً بإشعار خلال 10 أيام عمل، رسوم مطابقة لسقف التكلفة المباشرة (1,843.20 يورو)، مع فجوة في دليل التكافؤ الوظيفي بالمادة 28.',
    expectedStatus: 'conditional',
    input: {
      organizationName: 'AlpineGrid Industrial IoT BV',
      vendorOrProductName: 'FactoryTwin Hybrid Telemetry Cloud',
      role: 'dual-iot-and-cloud',
      assessmentDate: '2026-11-15',
      clock: {
        switchRequestDate: '2026-11-15',
        quotedNoticeDays: 45,
        quotedTransitionDays: 150,
        technicalInfeasibilityClaimed: true,
        infeasibilityNoticeWorkingDays: 10,
        infeasibilityReason:
          'Encrypted 45 TB industrial time-series sharding requires staged re-indexing across three EU availability zones.',
        quotedRetrievalDays: 35,
      },
      egress: {
        switchRequestDate: '2026-11-15',
        dataVolumeTb: 45,
        egressFeePerGbEur: 0.04,
        exitAdminFeeEur: 0,
        directTechnicalCostEur: 1843.2,
      },
      implementedControls: [
        'DA-ART3-01',
        'DA-ART3-02',
        'DA-ART25-01',
        'DA-ART26-01',
        'DA-ART29-01',
        'DA-ART30-01',
      ],
      vendorCsv: [
        'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur',
        'FactoryTwin Telemetry,Dual IoT Cloud,2026-11-15,45,150,10,true,35,45,0.04,0,1843.20',
      ].join('\n'),
    },
  },
  {
    id: 'post-2027-egress-lockin-blocked',
    titleEn: 'Post-2027 Cloud Lock-In & EUR 7,108 Illegal Egress Charge (Blocked)',
    titleAr: 'تقييد سحابي ورسوم خروج غير قانونية 7,108 يورو بعد 2027 (محجوب)',
    summaryEn:
      'Vendor attempting a 90-day notice period, 45-day transition without infeasibility notice, 14-day retrieval window, and EUR 7,108 switching/egress billing after 2027-01-12.',
    summaryAr:
      'مزود يفرض مهلة إشعار 90 يوماً وانتقال 45 يوماً دون مبرر واسترداد 14 يوماً وفوترة رسوم خروج وإدارة بقيمة 7,108 يورو بعد تاريخ الحظر 2027-01-12.',
    expectedStatus: 'blocked',
    input: {
      organizationName: 'Mediterranean FinOps Group',
      vendorOrProductName: 'LegacyVault Cloud ERP',
      role: 'cloud-customer',
      assessmentDate: '2027-02-01',
      clock: {
        switchRequestDate: '2027-02-01',
        quotedNoticeDays: 90,
        quotedTransitionDays: 45,
        technicalInfeasibilityClaimed: false,
        infeasibilityNoticeWorkingDays: null,
        infeasibilityReason: '',
        quotedRetrievalDays: 14,
      },
      egress: {
        switchRequestDate: '2027-02-01',
        dataVolumeTb: 80,
        egressFeePerGbEur: 0.08,
        exitAdminFeeEur: 554.4,
        directTechnicalCostEur: 4000,
      },
      implementedControls: ['DA-ART26-01'],
      vendorCsv: [
        'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur',
        'LegacyVault Cloud ERP,ERP Cloud,2027-02-01,90,45,,false,14,80,0.08,554.4,4000',
        'NeutralBucket Storage,Object Storage,2027-02-01,30,30,,false,30,10,0,0,0',
      ].join('\n'),
    },
  },
];

export function getDataActPreset(id: DataActPresetId): DataActPreset {
  const found = DATA_ACT_PRESETS.find((preset) => preset.id === id);
  if (!found) {
    throw new Error(`Unknown DataActKit preset "${id}".`);
  }
  return found;
}
