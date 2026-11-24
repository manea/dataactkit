import type { AuditFinding, ReadinessStatus, SwitchingClockInput, SwitchingClockResult } from './types.ts';

export const MAX_NOTICE_MONTHS = 2;
export const STANDARD_TRANSITION_DAYS = 30;
export const EXTENDED_TRANSITION_MAX_DAYS = 210; // 7-month outer bound under EU Data Act Art. 25(4)
export const INFEASIBILITY_NOTICE_WORKING_DAYS = 14;
export const MIN_RETRIEVAL_DAYS = 30;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDateUtc(dateStr: string): Date {
  if (!ISO_DATE_RE.test(dateStr)) {
    throw new Error(`Invalid ISO date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${dateStr}".`);
  }
  return dt;
}

export function formatIsoDateUtc(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysUtc(dateStr: string, days: number): string {
  if (!Number.isFinite(days)) {
    throw new Error(`Invalid days count: ${days}`);
  }
  const dt = parseIsoDateUtc(dateStr);
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(days));
  return formatIsoDateUtc(dt);
}

export function addMonthsUtc(dateStr: string, months: number): string {
  const dt = parseIsoDateUtc(dateStr);
  const targetYear = dt.getUTCFullYear();
  const targetMonthIndex = dt.getUTCMonth() + Math.trunc(months);
  const originalDay = dt.getUTCDate();
  const normalizedYear = targetYear + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(normalizedYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);
  return formatIsoDateUtc(new Date(Date.UTC(normalizedYear, normalizedMonth, clampedDay)));
}

export function diffDaysUtc(startDateStr: string, endDateStr: string): number {
  const startMs = parseIsoDateUtc(startDateStr).getTime();
  const endMs = parseIsoDateUtc(endDateStr).getTime();
  return Math.round((endMs - startMs) / 86_400_000);
}

/**
 * Advances by N UTC working days (Mon–Fri, excluding Saturday/Sunday).
 * National bank holidays are not assumed and must be layered if required locally.
 */
export function addWorkingDaysUtc(dateStr: string, workingDays: number): string {
  if (!Number.isInteger(workingDays) || workingDays < 0) {
    throw new Error(`workingDays must be a non-negative integer, received ${workingDays}`);
  }
  const cursor = parseIsoDateUtc(dateStr);
  let remaining = workingDays;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return formatIsoDateUtc(cursor);
}

export function evaluateSwitchingClock(input: SwitchingClockInput): SwitchingClockResult {
  const normalizedRequestDate = formatIsoDateUtc(parseIsoDateUtc(input.switchRequestDate));
  if (
    !Number.isFinite(input.quotedNoticeDays) ||
    !Number.isFinite(input.quotedTransitionDays) ||
    !Number.isFinite(input.quotedRetrievalDays) ||
    input.quotedNoticeDays < 0 ||
    input.quotedTransitionDays < 0 ||
    input.quotedRetrievalDays < 0
  ) {
    throw new Error('Notice, transition, and retrieval days must be finite non-negative numbers.');
  }

  const findings: AuditFinding[] = [];

  // 1. Notice period (Art. 25(2)(d): <= 2 calendar months; allow 60d floor for commercial Feb normalization)
  const maxLegalNoticeEndDate = addMonthsUtc(normalizedRequestDate, MAX_NOTICE_MONTHS);
  const exactTwoMonthDays = diffDaysUtc(normalizedRequestDate, maxLegalNoticeEndDate);
  const maxLegalNoticeDays = Math.max(exactTwoMonthDays, 60);
  const noticeEndDate = addDaysUtc(normalizedRequestDate, input.quotedNoticeDays);
  const noticeCompliant = input.quotedNoticeDays <= maxLegalNoticeDays;

  if (!noticeCompliant) {
    findings.push({
      code: 'DA-CLK-NOTICE-EXCEEDED',
      severity: 'blocker',
      article: 'Art. 25(2)(d)',
      messageEn: `Contractual notice period (${input.quotedNoticeDays}d, ends ${noticeEndDate}) exceeds the EU Data Act maximum of 2 months (${maxLegalNoticeDays}d, ${maxLegalNoticeEndDate}).`,
      messageAr: `مهلة الإشعار التعاقدية (${input.quotedNoticeDays} يوماً، تنتهي ${noticeEndDate}) تتجاوز الحد الأقصى في قانون البيانات الأوروبي البالغ شهرين (${maxLegalNoticeDays} يوماً).`,
    });
  }

  // 2. Mandatory transition period & optional technical infeasibility extension (Art. 25(2)(a) & 25(4))
  const infeasibilityNoticeDeadlineDate = addWorkingDaysUtc(
    normalizedRequestDate,
    INFEASIBILITY_NOTICE_WORKING_DAYS,
  );
  let infeasibilityNoticeCompliant = true;
  let maxAllowedTransitionDays = STANDARD_TRANSITION_DAYS;
  let transitionCompliant = false;

  if (!input.technicalInfeasibilityClaimed) {
    transitionCompliant = input.quotedTransitionDays <= STANDARD_TRANSITION_DAYS;
    if (!transitionCompliant) {
      findings.push({
        code: 'DA-CLK-TRANSITION-OVER-30D',
        severity: 'blocker',
        article: 'Art. 25(2)(a)',
        messageEn: `Quoted transition duration (${input.quotedTransitionDays}d) exceeds the mandatory 30-day standard transition period with no invoked technical infeasibility notice.`,
        messageAr: `مدة الانتقال المفروضة (${input.quotedTransitionDays} يوماً) تتجاوز مهلة الـ 30 يوماً الإلزامية دون إشعار مبرر بعدم الجدوى التقنية.`,
      });
    }
  } else {
    maxAllowedTransitionDays = EXTENDED_TRANSITION_MAX_DAYS;
    const noticeWd = input.infeasibilityNoticeWorkingDays;
    const hasReason = input.infeasibilityReason.trim().length >= 8;
    const noticeWithin14Wd =
      noticeWd !== null && Number.isFinite(noticeWd) && noticeWd >= 0 && noticeWd <= INFEASIBILITY_NOTICE_WORKING_DAYS;

    if (!noticeWithin14Wd || !hasReason) {
      infeasibilityNoticeCompliant = false;
      findings.push({
        code: 'DA-CLK-INFEASIBILITY-NOTICE-INVALID',
        severity: 'blocker',
        article: 'Art. 25(4)',
        messageEn: `Technical infeasibility extension requires substantiated justification AND provider notice within <= 14 working days (${infeasibilityNoticeDeadlineDate}); received ${noticeWd ?? 'missing'} working days.`,
        messageAr: `يتطلب تمديد عدم الجدوى التقنية تبريراً تقنياً مفصلاً وإخطار العميل خلال <= 14 يوم عمل (حتى ${infeasibilityNoticeDeadlineDate})؛ المسجل: ${noticeWd ?? 'غير متوفر'} يوم عمل.`,
      });
    }

    if (input.quotedTransitionDays > EXTENDED_TRANSITION_MAX_DAYS) {
      transitionCompliant = false;
      findings.push({
        code: 'DA-CLK-TRANSITION-OVER-7M',
        severity: 'blocker',
        article: 'Art. 25(4)',
        messageEn: `Extended transition duration (${input.quotedTransitionDays}d) breaches the absolute 7-month (210-day) ceiling under EU Data Act Art. 25(4).`,
        messageAr: `تجاوزت مدة الانتقال الممددة (${input.quotedTransitionDays} يوماً) السقف الأقصى البالغ 7 أشهر (210 يوماً) بموجب المادة 25(4).`,
      });
    } else if (infeasibilityNoticeCompliant) {
      transitionCompliant = true;
      findings.push({
        code: 'DA-CLK-EXTENDED-TRANSITION-EXCEPTION',
        severity: 'warning',
        article: 'Art. 25(4)',
        messageEn: `Provider invoked exceptional ${input.quotedTransitionDays}-day transition under Art. 25(4) (notice sent in ${noticeWd} working days <= 14). Retain milestone proof until completion.`,
        messageAr: `استخدم المزود التمديد الاستثنائي للانتقال (${input.quotedTransitionDays} يوماً ضمن حد 210 يوماً، بإخطار خلال ${noticeWd} يوم عمل <= 14)؛ يجب توثيق مراحل التنفيذ.`,
      });
    } else {
      transitionCompliant = false;
    }
  }

  const transitionDeadlineDate = addDaysUtc(noticeEndDate, input.quotedTransitionDays);

  // 3. Retrieval period after transition ends (Art. 25(2)(g): >= 30 calendar days)
  const retrievalCompliant = input.quotedRetrievalDays >= MIN_RETRIEVAL_DAYS;
  const retrievalDeadlineDate = addDaysUtc(transitionDeadlineDate, input.quotedRetrievalDays);

  if (!retrievalCompliant) {
    findings.push({
      code: 'DA-CLK-RETRIEVAL-BELOW-30D',
      severity: 'blocker',
      article: 'Art. 25(2)(g)',
      messageEn: `Post-transition data retrieval window (${input.quotedRetrievalDays}d) is shorter than the statutory minimum of 30 calendar days.`,
      messageAr: `مهلة استرداد البيانات بعد إتمام الانتقال (${input.quotedRetrievalDays} يوماً) أقل من الحد الأدنى الإلزامي البالغ 30 يوماً ميلادياً.`,
    });
  }

  let status: ReadinessStatus = 'ready';
  if (findings.some((f) => f.severity === 'blocker')) {
    status = 'blocked';
  } else if (findings.some((f) => f.severity === 'warning')) {
    status = 'conditional';
  }

  return {
    normalizedRequestDate,
    maxLegalNoticeEndDate,
    maxLegalNoticeDays,
    noticeEndDate,
    noticeCompliant,
    infeasibilityNoticeDeadlineDate,
    infeasibilityNoticeCompliant,
    maxAllowedTransitionDays,
    transitionDeadlineDate,
    transitionCompliant,
    minRequiredRetrievalDays: MIN_RETRIEVAL_DAYS,
    retrievalDeadlineDate,
    retrievalCompliant,
    status,
    findings,
  };
}
