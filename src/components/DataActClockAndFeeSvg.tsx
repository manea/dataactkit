import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { UI_LABELS, formatEur, isolateLtr, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  result: AssessmentResult;
}

export function DataActClockAndFeeSvg({ lang, input, result }: Props) {
  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';
  const clk = result.switchingClock;
  const fee = result.egressFee;

  // Timeline proportions across Notice + Transition + Retrieval (total scaled to 536px track)
  const nDays = Math.max(1, input.clock.quotedNoticeDays);
  const tDays = Math.max(1, input.clock.quotedTransitionDays);
  const rDays = Math.max(1, input.clock.quotedRetrievalDays);
  const totalDays = nDays + tDays + rDays;
  const trackW = 536;
  const nW = Math.max(44, Math.round((nDays / totalDays) * trackW));
  const tW = Math.max(44, Math.round((tDays / totalDays) * trackW));
  const rW = Math.max(44, trackW - nW - tW);

  const feeMax = Math.max(fee.totalQuotedSwitchingEur, fee.maxLegalChargeEur, 500);
  const quotedW = fee.totalQuotedSwitchingEur > 0 ? Math.max(6, Math.round((fee.totalQuotedSwitchingEur / feeMax) * trackW)) : 0;
  const ceilingW = fee.maxLegalChargeEur > 0 ? Math.max(6, Math.round((fee.maxLegalChargeEur / feeMax) * trackW)) : 0;

  return (
    <section className="da-card rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold">{t.chartTitle}</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t.chartSub}
        </p>
      </div>

      {/* Forced LTR container so dual SVG bars align identically in EN & AR */}
      <div
        className="rounded-xl border p-3.5 overflow-x-auto"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div dir="ltr">
          <svg
            style={{ direction: 'ltr' }}
            viewBox="0 0 560 184"
            className="w-full h-auto max-h-56"
            role="img"
            aria-label={isAr ? 'مخطط ساعة التبديل ورسوم الخروج' : 'DataActKit Art. 25 Switching Clock and Art. 29 Egress Ceiling'}
          >
            {/* Section 1: Art. 25 Switching Timeline */}
            <text x="12" y="18" fill="var(--text-primary)" fontSize="12" fontWeight="700">
              {isAr ? 'الجدول الزمني للتبديل السحابي (المادة 25)' : 'Art. 25 Contractual Switching Timeline'}
            </text>
            <text
              x="548"
              y="18"
              textAnchor="end"
              fill="var(--text-secondary)"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
            >
              {`${clk.normalizedRequestDate} -> ${clk.retrievalDeadlineDate}`}
            </text>

            {/* Notice bar */}
            <rect
              x="12"
              y="28"
              width={nW}
              height="24"
              rx="4"
              fill={clk.noticeCompliant ? 'var(--accent-primary)' : 'var(--accent-crimson)'}
            />
            <text x={12 + nW / 2} y="44" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {`${input.clock.quotedNoticeDays}d Ntc`}
            </text>

            {/* Transition bar */}
            <rect
              x={12 + nW + 2}
              y="28"
              width={Math.max(40, tW - 2)}
              height="24"
              rx="4"
              fill={
                !clk.transitionCompliant || !clk.infeasibilityNoticeCompliant
                  ? 'var(--accent-crimson)'
                  : input.clock.technicalInfeasibilityClaimed
                    ? 'var(--accent-amber)'
                    : 'var(--accent-teal)'
              }
            />
            <text x={12 + nW + tW / 2} y="44" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {`${input.clock.quotedTransitionDays}d Trn`}
            </text>

            {/* Retrieval bar */}
            <rect
              x={12 + nW + tW + 2}
              y="28"
              width={Math.max(40, rW - 4)}
              height="24"
              rx="4"
              fill={clk.retrievalCompliant ? '#0284C7' : 'var(--accent-crimson)'}
            />
            <text x={12 + nW + tW + rW / 2} y="44" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {`${input.clock.quotedRetrievalDays}d Ret`}
            </text>

            {/* Date milestones under timeline */}
            <text x="12" y="68" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {`Notice <= ${clk.maxLegalNoticeEndDate}`}
            </text>
            <text x="548" y="68" textAnchor="end" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {`14wd Infeas. Cutoff: ${clk.infeasibilityNoticeDeadlineDate}`}
            </text>

            {/* Section 2: Art. 29 Egress & Switching Charge vs Statutory Ceiling */}
            <text x="12" y="102" fill="var(--text-primary)" fontSize="12" fontWeight="700">
              {isAr ? 'رسوم التبديل والخروج المطلوبة مقابل الحد القانوني (المادة 29)' : 'Art. 29 Quoted Switching Charges vs Statutory Ceiling'}
            </text>
            <text
              x="548"
              y="102"
              textAnchor="end"
              fill={fee.compliant ? 'var(--accent-teal)' : 'var(--accent-crimson)'}
              fontSize="11"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {fee.isZeroChargeBanActive ? 'POST-2027-01-12: EUR 0 BAN' : 'PRE-2027 CAP'}
            </text>

            <rect x="12" y="112" width={trackW} height="16" rx="8" fill="var(--border-subtle)" fillOpacity="0.45" />
            {quotedW > 0 && (
              <rect
                x="12"
                y="112"
                width={quotedW}
                height="16"
                rx="8"
                fill={fee.illegalOverchargeEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)'}
              />
            )}
            <text x="12" y="142" fill="var(--text-secondary)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {`Quoted: EUR ${fee.totalQuotedSwitchingEur.toLocaleString('en-US')}`}
            </text>
            <text x="548" y="142" textAnchor="end" fill={fee.illegalOverchargeEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)'} fontSize="11" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {`Overcharge: EUR ${fee.illegalOverchargeEur.toLocaleString('en-US')}`}
            </text>

            <rect x="12" y="152" width={trackW} height="14" rx="7" fill="var(--border-subtle)" fillOpacity="0.45" />
            {ceilingW > 0 && <rect x="12" y="152" width={ceilingW} height="14" rx="7" fill="var(--accent-primary)" />}
            <text x="12" y="179" fill="var(--text-secondary)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {`Legal Ceiling (${fee.cutoffDate} ban = EUR 0): EUR ${fee.maxLegalChargeEur.toLocaleString('en-US')}`}
            </text>
          </svg>
        </div>

        <div className="mt-2 pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <span>
            {isAr
              ? `إجمالي الرسوم المطلوبة: ${formatEur(fee.totalQuotedSwitchingEur)} · السقف القانوني: ${formatEur(fee.maxLegalChargeEur)}`
              : `Quoted Total: ${formatEur(fee.totalQuotedSwitchingEur)} · Legal Cap: ${formatEur(fee.maxLegalChargeEur)}`}
          </span>
          <span className="da-mono font-semibold" style={{ color: fee.illegalOverchargeEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)' }}>
            {isAr ? `التجاوز غير القانوني: ${formatEur(fee.illegalOverchargeEur)}` : `Illegal Overcharge: ${formatEur(fee.illegalOverchargeEur)}`}
          </span>
        </div>
      </div>

      {/* Three Key Deadline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? `بوابة IoT المادة 3 (${isolateLtr('2026-09-12')})` : `Art. 3 IoT Gate (${isolateLtr('2026-09-12')})`}
          </div>
          <div className="font-bold mt-1" style={{ color: result.iotAccessByDesignActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
            {result.iotAccessByDesignActive
              ? (isAr ? 'مفعّلة (وصول بالتصميم إلزامي)' : 'ACTIVE (Access-by-Design Mandatory)')
              : (isAr ? 'قبل موعد السريان' : 'Pre-Effective Window')}
          </div>
        </div>

        <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? `حظر رسوم الخروج (${isolateLtr('2027-01-12')})` : `Art. 29 Egress Ban (${isolateLtr('2027-01-12')})`}
          </div>
          <div className="font-bold mt-1" style={{ color: fee.isZeroChargeBanActive ? 'var(--accent-teal)' : 'var(--accent-amber)' }}>
            {fee.isZeroChargeBanActive
              ? (isAr ? 'حظر 0 يورو سارٍ الآن' : 'EUR 0 Mandatory Ban Active')
              : (isAr ? 'مرحلة سقف التكلفة المباشرة' : 'Pre-2027 Direct Cost Cap')}
          </div>
        </div>

        <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'آخر موعد لإشعار عدم الجدوى (14 يوم عمل)' : 'Art. 25(4) 14-Working-Day Deadline'}
          </div>
          <div className="da-mono font-bold mt-1" style={{ color: clk.infeasibilityNoticeCompliant ? 'var(--accent-teal)' : 'var(--accent-crimson)' }}>
            {isolateLtr(clk.infeasibilityNoticeDeadlineDate)}
          </div>
        </div>
      </div>
    </section>
  );
}
