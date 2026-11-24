import type { AssessmentInput, AssessmentResult } from './types.ts';

export function buildDataActBriefMarkdown(
  input: AssessmentInput,
  result: AssessmentResult,
  dossierCode = 'DRAFT',
  sha256Digest = result.dossierSha256,
  locale: 'en' | 'ar' = 'en',
): string {
  const digest = sha256Digest || result.dossierSha256;
  const clk = result.switchingClock;
  const fee = result.egressFee;

  if (locale === 'ar') {
    const lines: string[] = [
      `# ملف جاهزية قانون البيانات الأوروبي (DataActKit) — ${dossierCode}`,
      '',
      `> **تنويه قانوني إلزامي**: ${result.disclaimerAr}`,
      '',
      `- **اللائحة المرجعية**: ${result.regulation}`,
      `- **المؤسسة**: ${result.organizationName}`,
      `- **المزود أو المنتج**: ${result.vendorOrProductName}`,
      `- **الدور التنظيمي**: \`${result.role}\``,
      `- **تاريخ التقييم**: ${result.assessmentDate}`,
      `- **حالة الجاهزية الإجمالية**: \`${result.status.toUpperCase()}\` (${result.readinessScore}/100)`,
      `- **بصمة SHA-256 المعيارية**: \`${digest}\``,
      '',
      '## 1. ساعة التبديل السحابي التعاقدية (المادة 25)',
      `- تاريخ طلب التبديل: ${clk.normalizedRequestDate}`,
      `- نهاية الإشعار المحتسبة: ${clk.noticeEndDate} (السقف الأقصى <= شهران / ${clk.maxLegalNoticeDays} يوماً حتى ${clk.maxLegalNoticeEndDate}) — ${clk.noticeCompliant ? 'مطابق' : 'مخالف'}`,
      `- موعد الانتقال النهائي: ${clk.transitionDeadlineDate} (السقف المسموح: ${clk.maxAllowedTransitionDays} يوماً) — ${clk.transitionCompliant ? 'مطابق' : 'مخالف'}`,
      `- موعد إشعار عدم الجدوى التقنية (<= 14 يوم عمل): ${clk.infeasibilityNoticeDeadlineDate} — ${clk.infeasibilityNoticeCompliant ? 'مطابق' : 'مخالف'}`,
      `- نهاية مهلة استرداد البيانات (>= 30 يوماً): ${clk.retrievalDeadlineDate} — ${clk.retrievalCompliant ? 'مطابق' : 'مخالف'}`,
      '',
      '## 2. رسوم التبديل والخروج السحابي (المادة 29 — حظر 0 يورو منذ 2027-01-12)',
      `- المرحلة السارية: \`${fee.phase}\` (حظر 0 يورو مفعّل؟ ${fee.isZeroChargeBanActive ? 'نعم' : 'لا'})`,
      `- إجمالي رسوم التبديل والخروج المطلوبة: EUR ${fee.totalQuotedSwitchingEur.toFixed(2)}`,
      `- الحد القانوني الأقصى المسموح به: EUR ${fee.maxLegalChargeEur.toFixed(2)}`,
      `- التجاوز غير القانوني المكتشف: EUR ${fee.illegalOverchargeEur.toFixed(2)}`,
      '',
      `## 3. ضوابط المادة 3 للأجهزة المتصلة (${result.iotAccessByDesignActive ? 'سارية >= 2026-09-12' : 'قبل 2026-09-12'}) والضوابط التشغيلية`,
      `- الضوابط المطبقة المستوفاة: ${result.implementedApplicableCount} / ${result.applicableControlsCount}`,
      `- الضوابط الناقصة: ${result.missingControls.length > 0 ? result.missingControls.join(', ') : 'لا يوجد'}`,
    ];

    if (result.batchAudit) {
      lines.push(
        '',
        '## 4. ملخص تدقيق البائعين الجماعي (CSV)',
        `- إجمالي البائعين: ${result.batchAudit.totalVendors} (جاهز: ${result.batchAudit.readyCount} · مشروط: ${result.batchAudit.conditionalCount} · محجوب: ${result.batchAudit.blockedCount})`,
        `- إجمالي التجاوز غير القانوني بالدفعة: EUR ${result.batchAudit.totalIllegalOverchargeEur.toFixed(2)}`,
      );
    }

    lines.push('', '## 5. الملاحظات والنتائج', ...result.findings.map((f) => `- [${f.severity.toUpperCase()} · ${f.code} · ${f.article}] ${f.messageAr}`));
    if (input.notes?.trim()) {
      lines.push('', '## 6. ملاحظات تشغيلية مرفقة', input.notes.trim());
    }
    return lines.join('\n') + '\n';
  }

  const lines: string[] = [
    `# EU Data Act Readiness Dossier (DataActKit) — ${dossierCode}`,
    '',
    `> **Mandatory Disclaimer**: ${result.disclaimerEn}`,
    '',
    `- **Regulation**: ${result.regulation}`,
    `- **Organization**: ${result.organizationName}`,
    `- **Vendor / Connected Product**: ${result.vendorOrProductName}`,
    `- **Scoped Role**: \`${result.role}\``,
    `- **Assessment Date**: ${result.assessmentDate}`,
    `- **Overall Status**: \`${result.status.toUpperCase()}\` (${result.readinessScore}/100)`,
    `- **Canonical SHA-256 Digest**: \`${digest}\``,
    '',
    '## 1. Contractual Cloud Switching Clock (Article 25)',
    `- Switch Request Date: ${clk.normalizedRequestDate}`,
    `- Quoted Notice End: ${clk.noticeEndDate} (<= 2-month ceiling / ${clk.maxLegalNoticeDays}d by ${clk.maxLegalNoticeEndDate}) — ${clk.noticeCompliant ? 'COMPLIANT' : 'BREACH'}`,
    `- Transition Completion Date: ${clk.transitionDeadlineDate} (max allowed ${clk.maxAllowedTransitionDays}d) — ${clk.transitionCompliant ? 'COMPLIANT' : 'BREACH'}`,
    `- Technical Infeasibility Notice Cutoff (<= 14 working days): ${clk.infeasibilityNoticeDeadlineDate} — ${clk.infeasibilityNoticeCompliant ? 'COMPLIANT' : 'BREACH'}`,
    `- Minimum Data Retrieval Window End (>= 30d): ${clk.retrievalDeadlineDate} — ${clk.retrievalCompliant ? 'COMPLIANT' : 'BREACH'}`,
    '',
    '## 2. Switching & Egress Fee Audit (Article 29 — EUR 0 Ban from 2027-01-12)',
    `- Applicable Phase: \`${fee.phase}\` (EUR 0 ban active? ${fee.isZeroChargeBanActive ? 'YES' : 'NO'})`,
    `- Total Quoted Switching & Egress Charges: EUR ${fee.totalQuotedSwitchingEur.toFixed(2)}`,
    `- Statutory Fee Ceiling: EUR ${fee.maxLegalChargeEur.toFixed(2)}`,
    `- Illegal Overcharge Detected: EUR ${fee.illegalOverchargeEur.toFixed(2)}`,
    '',
    `## 3. Connected IoT Art. 3 Gate (${result.iotAccessByDesignActive ? 'ACTIVE >= 2026-09-12' : 'PRE-2026-09-12'}) & Controls`,
    `- Applicable Controls Implemented: ${result.implementedApplicableCount} / ${result.applicableControlsCount}`,
    `- Missing Controls: ${result.missingControls.length > 0 ? result.missingControls.join(', ') : 'None'}`,
  ];

  if (result.batchAudit) {
    lines.push(
      '',
      '## 4. Multi-Vendor Batch CSV Audit Summary',
      `- Vendors Audited: ${result.batchAudit.totalVendors} (Ready: ${result.batchAudit.readyCount}, Conditional: ${result.batchAudit.conditionalCount}, Blocked: ${result.batchAudit.blockedCount})`,
      `- Batch Total Illegal Overcharge: EUR ${result.batchAudit.totalIllegalOverchargeEur.toFixed(2)}`,
    );
  }

  lines.push('', '## 5. Findings', ...result.findings.map((f) => `- [${f.severity.toUpperCase()} · ${f.code} · ${f.article}] ${f.messageEn}`));
  if (input.notes?.trim()) {
    lines.push('', '## 6. Attached Notes', input.notes.trim());
  }
  return lines.join('\n') + '\n';
}
