import type { DataActRole, ReadinessStatus } from '../core/types.ts';

export type UiLang = 'en' | 'ar';
export type UiTheme = 'brussels-vellum' | 'interconnect-slate';

/** Wraps LTR tokens with Unicode FSI/PDI isolates so Arabic RTL sentences never scramble dates or currency codes. */
export function isolateLtr(value: string | number): string {
  return `\u2066${String(value)}\u2069`;
}

export function formatEur(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return isolateLtr(`EUR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

export const ROLE_LABELS: Record<DataActRole, { en: string; ar: string }> = {
  'cloud-customer': {
    en: 'Cloud / SaaS Customer (Switching Buyer)',
    ar: 'عميل سحابة / SaaS (مشتري انتقال)',
  },
  'cloud-provider': {
    en: 'Data Processing Provider (IaaS / PaaS / SaaS)',
    ar: 'مزود خدمات معالجة البيانات السحابية',
  },
  'iot-connected-provider': {
    en: 'Connected IoT Product & Related Service Maker',
    ar: 'مصنّع أجهزة IoT متصلة وخدمات مرتبطة',
  },
  'dual-iot-and-cloud': {
    en: 'Dual IoT Manufacturer + Cloud Platform',
    ar: 'مزود مزدوج (أجهزة IoT + منصة سحابية)',
  },
};

export const STATUS_META: Record<
  ReadinessStatus,
  { en: string; ar: string; bgVar: string; textVar: string }
> = {
  ready: {
    en: 'READY / COMPLIANT',
    ar: 'جاهز / مطابق',
    bgVar: 'var(--accent-teal-soft)',
    textVar: 'var(--accent-teal)',
  },
  conditional: {
    en: 'CONDITIONAL REVIEW',
    ar: 'جاهزية مشروطة',
    bgVar: 'var(--accent-amber-soft)',
    textVar: 'var(--accent-amber)',
  },
  blocked: {
    en: 'BLOCKED / BREACH',
    ar: 'محجوب / مخالفة',
    bgVar: 'var(--accent-crimson-soft)',
    textVar: 'var(--accent-crimson)',
  },
};

export const UI_LABELS = {
  en: {
    appName: 'DataActKit',
    subtitle: 'EU Data Act (Regulation (EU) 2023/2854) Switching Clock, EUR 0 Egress 2027 & IoT Checker',
    sqliteMode: 'SQLite WAL Connected',
    localMode: '$0 Local Browser Mode',
    themeLight: 'Drafting Vellum',
    themeDark: 'Interconnect Slate',
    langToggle: 'العربية RTL',
    presetsTitle: 'Scenario Presets (One-Click Audit)',
    scopeTitle: '1. Organization Scope & Art. 25 Switching Clock',
    scopeSub: 'Notice <= 2 months · Transition 30d (<= 7 mo w/ 14 working-day infeasibility notice) · Retrieval >= 30d',
    organizationName: 'Organization / Buyer Entity',
    vendorOrProductName: 'Cloud Vendor / Connected IoT Product',
    roleLabel: 'Regulation (EU) 2023/2854 Role',
    assessmentDate: 'Assessment Date (IoT: 2026-09-12)',
    switchRequestDate: 'Switch Request (Ban: 2027-01-12)',
    quotedNoticeDays: 'Contractual Notice Period (days, max 2 mo)',
    quotedTransitionDays: 'Mandatory Transition Window (days)',
    quotedRetrievalDays: 'Post-Transition Retrieval Window (days, min 30d)',
    infeasibilityClaimed: 'Vendor claimed Art. 25(4) Technical Infeasibility extension (<= 7 mo / 210d)',
    infeasibilityWd: 'Written Infeasibility Notice Sent In (working days, max 14)',
    infeasibilityReason: 'Substantiated Technical Reason',
    saveProfile: 'Save Profile',
    savedProfiles: 'Saved Profiles',
    egressTitle: '2. Art. 29 Egress Fees (2027-01-12 Zero Ban) & Controls',
    egressSub: 'Direct technical cost cap until 2027-01-11, then mandatory EUR 0 switching/egress ban from 2027-01-12.',
    dataVolumeTb: 'Exportable Data Volume (TB)',
    egressPerGb: 'Quoted Egress Rate (EUR / GB)',
    exitAdminFee: 'Quoted Exit / Admin Charge (EUR)',
    directTechCost: 'Verified Direct Switching Cost (Pre-2027 cap, EUR)',
    parallelAgreed: 'Art. 29(4) in-situ parallel processing agreed explicitly',
    controlsChecklist: 'Organizational & Technical Controls Checklist',
    chartTitle: 'Switching Clock & Egress Fee Statutory Audit',
    chartSub: 'Real-time Art. 25 transition timeline vs Art. 29 switching & egress charge ceiling',
    batchTitle: '3. Multi-Vendor Batch CSV Auditor & CWE-1236 Safe Exporter',
    batchSub: 'Paste or upload vendor contracts CSV (, / ; / tab). Formula-injection escaped on UTF-8 BOM export.',
    loadSampleCsv: 'Load Multi-Vendor CSV Sample',
    exportSafeCsv: 'Export Safe BOM CSV',
    dossierTitle: '4. Canonical Readiness Dossier & Atomic Lock (DA-YYYY-0001)',
    saveDraft: 'Save Draft Dossier',
    sealDossier: 'Seal & Stamp DA Code',
    duplicateDraft: 'Duplicate Editable Draft',
    deleteDraft: 'Delete Draft',
    downloadMd: 'Download Brief (.md)',
    downloadCsv: 'Download Safe CSV',
    openShareLink: 'Open Public Share View',
    printA4: 'Print / Save A4 PDF',
    savedDossiers: 'Saved Dossiers Vault',
    findingsTitle: 'Deterministic Rule Findings',
    notesPlaceholder: 'Optional engineering exit runbook or legal counsel escalation notes...',
    disclaimerLabel: 'Mandatory Operational Notice',
    publicBack: 'Back to Interactive DataActKit Studio',
  },
  ar: {
    appName: 'DataActKit | عزم للبيانات الأوروبية',
    subtitle: 'مدقق قانون البيانات الأوروبي (2023/2854): ساعة التبديل السحابي، حظر رسوم الخروج 2027 وIoT',
    sqliteMode: 'متصل بقاعدة SQLite WAL',
    localMode: 'وضع المتصفح المحلي $0',
    themeLight: 'ورق بروكسل النهاري',
    themeDark: 'لوح الربط الليلي',
    langToggle: 'English LTR',
    presetsTitle: 'حزم سيناريوهات جاهزة (تدقيق بنقرة واحدة)',
    scopeTitle: '1. النطاق التنظيمي وساعة التبديل السحابي (المادة 25)',
    scopeSub: 'الإشعار <= شهرين · الانتقال 30 يوماً (حتى 7 أشهر بإخطار خلال 14 يوم عمل) · الاسترداد >= 30 يوماً',
    organizationName: 'المؤسسة / المشتري',
    vendorOrProductName: 'مزود السحابة أو المنتج المتصل (IoT)',
    roleLabel: 'الدور وفق قانون البيانات الأوروبي',
    assessmentDate: `تاريخ التقييم (${isolateLtr('2026-09-12')})`,
    switchRequestDate: `تاريخ التبديل (${isolateLtr('2027-01-12')})`,
    quotedNoticeDays: 'مهلة الإشعار التعاقدية (أيام، بحد شهرين)',
    quotedTransitionDays: 'مدة الانتقال المفروضة (أيام)',
    quotedRetrievalDays: 'مهلة استرداد البيانات بعد الانتقال (حد أدنى 30 يوماً)',
    infeasibilityClaimed: 'ادّعى المزود عدم الجدوى التقنية بموجب المادة 25(4) للتمديد حتى 7 أشهر (210 يوماً)',
    infeasibilityWd: 'إخطار عدم الجدوى خلال (أيام عمل، الحد 14)',
    infeasibilityReason: 'المبرر التقني الموثق للتمديد',
    saveProfile: 'حفظ كملف',
    savedProfiles: 'الملفات المحفوظة',
    egressTitle: '2. رسوم الخروج والتبديل السحابي (المادة 29) وضوابط الجاهزية',
    egressSub: 'سقف التكلفة المباشرة قبل 2027-01-12، ثم حظر قطعي 0 يورو ابتداءً من 2027-01-12.',
    dataVolumeTb: 'حجم البيانات القابلة للتصدير (TB)',
    egressPerGb: 'سعر الخروج المطلوب (EUR / GB)',
    exitAdminFee: 'رسوم إدارية أو مغادرة مفروضة (EUR)',
    directTechCost: 'التكلفة التقنية المباشرة المثبتة (سقف قبل 2027، EUR)',
    parallelAgreed: 'اتفاق صريح على معالجة متوازية بالمادة 29(4)',
    controlsChecklist: 'مصفوفة ضوابط المادة 3 و25 و26 و28 و29 و30',
    chartTitle: 'التحليل البصري لساعة التبديل ورسوم الخروج القانونية',
    chartSub: 'مقارنة مراحل المادة 25 زمنياً مقابل سقف المادة 29 لرسوم التبديل والخروج',
    batchTitle: '3. مدقق البائعين الجماعي CSV والمصدّر الآمن ضد حقن الصيغ',
    batchSub: 'ألصق أو ارفع ملف بائعي السحابة (فاصلة أو منقوطة أو تبويب) مع تصدير محمي بـ UTF-8 BOM.',
    loadSampleCsv: 'تحميل عينة CSV متعددة البائعين',
    exportSafeCsv: 'تصدير CSV آمن (BOM)',
    dossierTitle: `4. ملف الجاهزية المعياري والختم الذري (${isolateLtr('DA-YYYY-0001')})`,
    saveDraft: 'حفظ مسودة الملف',
    sealDossier: 'ختم الملف برمز رسمي',
    duplicateDraft: 'نسخ كمسودة قابلة للتعديل',
    deleteDraft: 'حذف المسودة',
    downloadMd: 'تحميل التقرير (.md)',
    downloadCsv: 'تحميل CSV الآمن',
    openShareLink: 'فتح صفحة المشاركة العامة',
    printA4: 'طباعة / حفظ PDF A4',
    savedDossiers: 'خزينة الملفات المحفوظة',
    findingsTitle: 'نتائج التدقيق الحتمية',
    notesPlaceholder: 'ملاحظات فريق الهندسة أو تصعيد المراجعة القانونية...',
    disclaimerLabel: 'تنويه تنظيمي إلزامي',
    publicBack: 'العودة إلى أستوديو DataActKit التفاعلي',
  },
} as const;
