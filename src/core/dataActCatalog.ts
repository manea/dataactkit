import type { ControlDefinition, ControlEvaluation, DataActControlId, DataActRole } from './types.ts';

export const EU_DATA_ACT_REGULATION = 'Regulation (EU) 2023/2854';
export const DATA_ACT_APPLICATION_DATE = '2025-09-12';
export const IOT_ACCESS_BY_DESIGN_DATE = '2026-09-12';
export const EGRESS_ZERO_CHARGE_DATE = '2027-01-12';

export const DISCLAIMER_EN =
  'DataActKit provides deterministic operational readiness metrics under Regulation (EU) 2023/2854 (EU Data Act) for engineering, FinOps, and governance review only. It is NOT legal counsel and does not replace qualified legal advice or a national Data Coordinator ruling.';

export const DISCLAIMER_AR =
  'توفر أداة DataActKit مؤشرات جاهزية تشغيلية وحسابات إرشادية بموجب قانون البيانات الأوروبي Regulation (EU) 2023/2854 لأغراض الهندسة والحوكمة فقط؛ وهي ليست استشارة قانونية ولا بديلاً عن المستشار القانوني المؤهل أو منسق البيانات الوطني المختص.';

export const DATA_ACT_CONTROLS: readonly ControlDefinition[] = [
  {
    id: 'DA-ART3-01',
    article: 'Art. 3(1)',
    scope: 'iot-design',
    effectiveFrom: IOT_ACCESS_BY_DESIGN_DATE,
    titleEn: 'Connected Product Access by Design',
    titleAr: 'إتاحة الوصول للبيانات بالتصميم للأجهزة المتصلة',
    summaryEn:
      'Design connected IoT products and related services so product and service data are directly accessible to the user by default, free of charge, in a structured, commonly used, machine-readable format.',
    summaryAr:
      'تصميم المنتجات المتصلة والخدمات ذات الصلة بحيث تتاح البيانات للمستخدم افتراضياً ومجاناً وبصيغة منظمة ومقروءة آلياً منذ 12 سبتمبر 2026.',
    evidenceHintEn: 'Device API spec, user portal export screenshot, telemetry schema.',
    evidenceHintAr: 'مواصفات واجهة برمجة الجهاز، لقطة تصدير بوابة المستخدم، مخطط القياسات.',
  },
  {
    id: 'DA-ART3-02',
    article: 'Art. 3(2)-(3)',
    scope: 'iot-design',
    effectiveFrom: IOT_ACCESS_BY_DESIGN_DATE,
    titleEn: 'Pre-Contractual Connected Data Transparency',
    titleAr: 'الشفافية التعاقدية المسبقة لبيانات الأجهزة المتصلة',
    summaryEn:
      'Disclose data type, format, estimated volume, continuous/real-time generation, storage location/retention duration, and user access/deletion instructions before concluding a purchase, rent, or lease contract.',
    summaryAr:
      'الإفصاح المسبق قبل التعاقد عن نوع البيانات وصيغتها وحجمها التقديري وتواترها ومدة الاحتفاظ بها وطريقة وصول المستخدم أو طلب المسح.',
    evidenceHintEn: 'Signed pre-contractual datasheet / public hardware data notice URL.',
    evidenceHintAr: 'ورقة الإفصاح المسبق قبل التعاقد أو رابط إشعار بيانات الجهاز.',
  },
  {
    id: 'DA-ART25-01',
    article: 'Art. 25',
    scope: 'switching-contract',
    effectiveFrom: DATA_ACT_APPLICATION_DATE,
    titleEn: 'Mandatory Cloud Switching Contractual Clauses',
    titleAr: 'البنود التعاقدية الإلزامية للانتقال السحابي',
    summaryEn:
      'Guarantee in writing: notice period <= 2 months, standard mandatory transition <= 30 calendar days (or <= 7 months justified within 14 working days), retrieval window >= 30 calendar days, and exhaustive exportable asset inventory.',
    summaryAr:
      'النص التعاقدي الصريح على مهلة إشعار <= شهرين، وانتقال قياسي <= 30 يوماً (أو <= 7 أشهر مبرراً خلال 14 يوم عمل)، واسترداد >= 30 يوماً، وجرد كامل للبيانات القابلة للتصدير.',
    evidenceHintEn: 'Cloud Addendum / MSA Switching Schedule with fixed notice/transition/retrieval SLAs.',
    evidenceHintAr: 'ملحق الانتقال السحابي في العقد متضمناً مهل الإشعار والانتقال والاسترداد.',
  },
  {
    id: 'DA-ART26-01',
    article: 'Art. 26',
    scope: 'switching-contract',
    effectiveFrom: DATA_ACT_APPLICATION_DATE,
    titleEn: 'Online Switching Transparency Register & Legal Restrictions Disclosure',
    titleAr: 'سجل الشفافية الإلكتروني وقيود الاختصاص والهندسة التقنية',
    summaryEn:
      'Publish up-to-date online register links detailing available transition procedures, data formats, known interoperability limits, non-EU jurisdiction access risks, and pre-2027-01-12 switching fee schedules.',
    summaryAr:
      'نشر سجل إلكتروني محدث يوضح إجراءات التبديل والصيغ المدعومة والقيود التقنية ومخاطر الاختصاص غير الأوروبي وجداول الرسوم قبل 2027-01-12.',
    evidenceHintEn: 'Public switching transparency portal page and export specification docs.',
    evidenceHintAr: 'رابط بوابة شفافية الانتقال ومستندات مواصفات التصدير.',
  },
  {
    id: 'DA-ART28-01',
    article: 'Art. 28 & 30',
    scope: 'interoperability',
    effectiveFrom: DATA_ACT_APPLICATION_DATE,
    titleEn: 'Functional Equivalence & Open Interface Interoperability',
    titleAr: 'التكافؤ الوظيفي وقابلية التشغيل البيني بالمعايير المفتوحة',
    summaryEn:
      'Ensure IaaS functional equivalence or PaaS/SaaS open interfaces, schema export, and zero commercial/technical lock-in obstacles obstructing migration to another provider or on-premises.',
    summaryAr:
      'تأمين التكافؤ الوظيفي للبنية التحتية أو واجهات التصدير المفتوحة لـ PaaS/SaaS دون عوائق تقنية أو تجارية تعطل الانتقال.',
    evidenceHintEn: 'OpenAPI / Parquet / JSON-LD export adapter & migration runbook.',
    evidenceHintAr: 'محولات تصدير المخططات بالمعايير المفتوحة ودليل الهجرة التشغيلية.',
  },
  {
    id: 'DA-ART29-01',
    article: 'Art. 29',
    scope: 'egress-fees',
    effectiveFrom: EGRESS_ZERO_CHARGE_DATE,
    titleEn: 'Switching & Egress Fee Phase-Out (EUR 0 from 2027-01-12)',
    titleAr: 'إلغاء رسوم التبديل والخروج السحابي (0 يورو من 12 يناير 2027)',
    summaryEn:
      'Cap charges to direct verified technical switching costs before 12 January 2027, and remove all switching and data egress charges (EUR 0) from 12 January 2027 onwards.',
    summaryAr:
      'حصر الرسوم بالتكلفة التقنية المباشرة فقط قبل 12 يناير 2027، وإلغاء كافة رسوم التبديل ونقل البيانات للخارج (0 يورو) نهائياً بدءاً من 12 يناير 2027.',
    evidenceHintEn: 'Updated 2027 pricing addendum and billing SKU retirement record.',
    evidenceHintAr: 'ملحق تسعير 2027 المحدث وسجل إيقاف بنود فواتير رسوم الخروج (Egress SKU).',
  },
  {
    id: 'DA-ART30-01',
    article: 'Art. 25 & 27',
    scope: 'exit-governance',
    effectiveFrom: DATA_ACT_APPLICATION_DATE,
    titleEn: 'Good-Faith Transition Assistance & Full Data Erasure Attestation',
    titleAr: 'المساعدة بحسن نية أثناء الانتقال وشهادة المسح الكامل',
    summaryEn:
      'Maintain business continuity and high security during data transfer, terminate cleanly after transition, and verify full erasure of customer exportable assets once the >= 30-day retrieval period expires.',
    summaryAr:
      'الحفاظ على استمرارية الخدمة والأمن أثناء النقل وإنهاء العقد بسلاسة والتحقق من المسح الكامل لبيانات العميل بعد انقضاء مهلة الاسترداد (>= 30 يوماً).',
    evidenceHintEn: 'Exit handover checklist and cryptographic erasure certificate template.',
    evidenceHintAr: 'قائمة تسليم الخروج ونموذج شهادة المسح الموثَّق للبيانات.',
  },
];

export function evaluateControls(
  role: DataActRole,
  assessmentDate: string,
  switchRequestDate: string,
  implementedControls: readonly DataActControlId[],
): ControlEvaluation[] {
  const implementedSet = new Set<DataActControlId>(implementedControls);
  const includesIot = role === 'iot-connected-provider' || role === 'dual-iot-and-cloud';
  const includesCloud = role !== 'iot-connected-provider';
  const iotEffective = assessmentDate >= IOT_ACCESS_BY_DESIGN_DATE;
  const zeroEgressActive = switchRequestDate >= EGRESS_ZERO_CHARGE_DATE;

  return DATA_ACT_CONTROLS.map((definition) => {
    const implemented = implementedSet.has(definition.id);

    if (definition.scope === 'iot-design') {
      if (!includesIot) {
        return {
          definition,
          applicable: false,
          implemented,
          reasonEn: 'Not required for pure cloud customer/provider scope.',
          reasonAr: 'غير مطلوب لنطاق الخدمات السحابية الصرف دون منتجات IoT متصلة.',
        };
      }
      if (!iotEffective) {
        return {
          definition,
          applicable: false,
          implemented,
          reasonEn: `Advisory before Art. 3 deadline (${IOT_ACCESS_BY_DESIGN_DATE}); will become mandatory on that date.`,
          reasonAr: `إرشادي قبل سريان المادة 3 (${IOT_ACCESS_BY_DESIGN_DATE})؛ يصبح إلزامياً عند هذا التاريخ.`,
        };
      }
      return {
        definition,
        applicable: true,
        implemented,
        reasonEn: implemented
          ? 'Art. 3 connected-product access-by-design obligation attested.'
          : 'Missing Art. 3 connected-product access-by-design evidence (active since 2026-09-12).',
        reasonAr: implemented
          ? 'تم إثبات الامتثال لمتطلب المادة 3 للوصول بالتصميم للأجهزة المتصلة.'
          : 'ينقص دليل امتثال المادة 3 للوصول بالتصميم للأجهزة المتصلة (سارٍ منذ 2026-09-12).',
      };
    }

    if (!includesCloud) {
      return {
        definition,
        applicable: false,
        implemented,
        reasonEn: 'Cloud switching & egress controls apply when data processing services are in scope.',
        reasonAr: 'ضوابط التبديل السحابي ورسوم الخروج تنطبق عندما تكون خدمات المعالجة السحابية ضمن النطاق.',
      };
    }

    if (definition.id === 'DA-ART29-01') {
      return {
        definition,
        applicable: true,
        implemented,
        reasonEn: implemented
          ? zeroEgressActive
            ? 'EUR 0 switching/egress fee policy attested for post-2027-01-12 window.'
            : 'Pre-2027 direct technical cost cap policy and 2027 phase-out plan attested.'
          : zeroEgressActive
            ? 'Missing Art. 29 EUR 0 switching/egress policy confirmation (active since 2027-01-12).'
            : 'Missing Art. 29 fee phase-out plan ahead of 2027-01-12 ban.',
        reasonAr: implemented
          ? zeroEgressActive
            ? 'تم توثيق سياسة إلغاء رسوم التبديل والخروج (0 يورو) بعد 2027-01-12.'
            : 'تم توثيق خطة سقف التكلفة المباشرة قبل 2027 والتحول لإلغاء الرسوم في 2027.'
          : zeroEgressActive
            ? 'ينقص توثيق سياسة 0 يورو لرسوم التبديل والخروج بموجب المادة 29 (سارية منذ 2027-01-12).'
            : 'تنقص خطة إلغاء رسوم التبديل والخروج بالمادة 29 قبل موعد 2027-01-12.',
      };
    }

    return {
      definition,
      applicable: true,
      implemented,
      reasonEn: implemented
        ? `${definition.article} control attested in organizational evidence.`
        : `Missing ${definition.article} (${definition.titleEn}) attestation.`,
      reasonAr: implemented
        ? `تم توثيق ضابط ${definition.article} ضمن أدلة الجاهزية.`
        : `ينقص توثيق ضابط ${definition.article} (${definition.titleAr}).`,
    };
  });
}
