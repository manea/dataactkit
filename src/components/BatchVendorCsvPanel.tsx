import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { DATA_ACT_PRESETS } from '../core/index.ts';
import { downloadSafeBomCsv } from '../lib/api.ts';
import { STATUS_META, UI_LABELS, formatEur, isolateLtr, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  result: AssessmentResult;
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
}

export function BatchVendorCsvPanel({ lang, input, result, locked, onChange }: Props) {
  const t = UI_LABELS[lang];
  const batch = result.batchAudit;

  const handleFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ ...input, vendorCsv: reader.result });
      }
    };
    reader.readAsText(file, 'utf8');
  };

  return (
    <section className="da-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <span>{t.batchTitle}</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.batchSub}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={locked}
            onClick={() => onChange({ ...input, vendorCsv: DATA_ACT_PRESETS[2]!.input.vendorCsv })}
            className="px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            {t.loadSampleCsv}
          </button>

          <label
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-medium ${locked ? 'opacity-50' : 'cursor-pointer'}`}
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={locked}
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
            />
          </label>

          <button
            type="button"
            onClick={() => downloadSafeBomCsv(input, result, `${input.organizationName}-vendors`)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportSafeCsv}</span>
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        disabled={locked}
        dir="ltr"
        className="da-input da-mono text-xs"
        placeholder="vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur"
        value={input.vendorCsv ?? ''}
        onChange={(e) => onChange({ ...input, vendorCsv: e.target.value })}
      />

      {batch && batch.totalVendors > 0 && (
        <div className="space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3 da-mono">
            <span>
              {lang === 'ar' ? 'الإجمالي:' : 'Vendors:'} <strong>{batch.totalVendors}</strong>
            </span>
            <span style={{ color: 'var(--accent-teal)' }}>
              {lang === 'ar' ? 'جاهز:' : 'Ready:'} <strong>{batch.readyCount}</strong>
            </span>
            <span style={{ color: 'var(--accent-amber)' }}>
              {lang === 'ar' ? 'مشروط:' : 'Conditional:'} <strong>{batch.conditionalCount}</strong>
            </span>
            <span style={{ color: 'var(--accent-crimson)' }}>
              {lang === 'ar' ? 'محجوب:' : 'Blocked:'} <strong>{batch.blockedCount}</strong>
            </span>
            <span className="ms-auto font-bold" style={{ color: batch.totalIllegalOverchargeEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)' }}>
              {lang === 'ar' ? 'إجمالي التجاوز:' : 'Total Illegal Overcharge:'}{' '}
              {formatEur(batch.totalIllegalOverchargeEur)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  <th className="p-2.5 text-start font-semibold">{lang === 'ar' ? 'المزود' : 'Vendor'}</th>
                  <th className="p-2.5 text-start font-semibold">{lang === 'ar' ? 'تاريخ الطلب' : 'Switch Date'}</th>
                  <th className="p-2.5 text-start font-semibold">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="p-2.5 text-start font-semibold">{lang === 'ar' ? 'المفروض' : 'Quoted'}</th>
                  <th className="p-2.5 text-start font-semibold">{lang === 'ar' ? 'التجاوز' : 'Overcharge'}</th>
                </tr>
              </thead>
              <tbody>
                {batch.vendors.map((v) => {
                  const st = STATUS_META[v.status];
                  return (
                    <tr key={`${v.rowNumber}-${v.vendorName}`} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="p-2.5 font-semibold">{v.vendorName}</td>
                      <td className="p-2.5 da-mono">{isolateLtr(v.switchRequestDate)}</td>
                      <td className="p-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold inline-block"
                          style={{ backgroundColor: st.bgVar, color: st.textVar }}
                        >
                          {st[lang]}
                        </span>
                      </td>
                      <td className="p-2.5 da-mono num-tabular">{formatEur(v.totalQuotedSwitchingEur)}</td>
                      <td
                        className="p-2.5 da-mono num-tabular font-bold"
                        style={{ color: v.illegalOverchargeEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)' }}
                      >
                        {formatEur(v.illegalOverchargeEur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
