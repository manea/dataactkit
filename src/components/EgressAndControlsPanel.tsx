import { CheckSquare, Euro, ShieldCheck } from 'lucide-react';
import type {
  AssessmentInput,
  ControlEvaluation,
  DataActControlId,
  EgressFeeResult,
} from '../core/types.ts';
import { UI_LABELS, formatEur, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  egressResult: EgressFeeResult;
  controls: ControlEvaluation[];
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
}

export function EgressAndControlsPanel({
  lang,
  input,
  egressResult,
  controls,
  locked,
  onChange,
}: Props) {
  const t = UI_LABELS[lang];
  const fee = input.egress;

  const updateEgress = (patch: Partial<AssessmentInput['egress']>) => {
    onChange({ ...input, egress: { ...fee, ...patch } });
  };

  const toggleControl = (controlId: DataActControlId) => {
    const exists = input.implementedControls.includes(controlId);
    const nextList = exists
      ? input.implementedControls.filter((c) => c !== controlId)
      : [...input.implementedControls, controlId];
    onChange({ ...input, implementedControls: nextList });
  };

  return (
    <section className="da-card rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <Euro className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <span>{t.egressTitle}</span>
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t.egressSub}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.dataVolumeTb}
          </span>
          <input
            type="number"
            step="0.5"
            min={0}
            className="da-input da-mono num-tabular"
            disabled={locked}
            value={fee.dataVolumeTb}
            onChange={(e) => updateEgress({ dataVolumeTb: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.egressPerGb}
          </span>
          <input
            type="number"
            step="0.01"
            min={0}
            className="da-input da-mono num-tabular"
            disabled={locked}
            value={fee.egressFeePerGbEur}
            onChange={(e) => updateEgress({ egressFeePerGbEur: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.exitAdminFee}
          </span>
          <input
            type="number"
            step="10"
            min={0}
            className="da-input da-mono num-tabular"
            disabled={locked}
            value={fee.exitAdminFeeEur}
            onChange={(e) => updateEgress({ exitAdminFeeEur: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.directTechCost}
          </span>
          <input
            type="number"
            step="50"
            min={0}
            className="da-input da-mono num-tabular"
            disabled={locked || egressResult.isZeroChargeBanActive}
            value={fee.directTechnicalCostEur}
            onChange={(e) =>
              updateEgress({ directTechnicalCostEur: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={locked}
            checked={Boolean(fee.parallelProcessingAgreed)}
            onChange={(e) => updateEgress({ parallelProcessingAgreed: e.target.checked })}
          />
          <span>{t.parallelAgreed}</span>
        </label>

        <div className="flex items-center gap-3 da-mono">
          <span>
            {lang === 'ar' ? 'المفروض:' : 'Quoted:'}{' '}
            <strong>{formatEur(egressResult.totalQuotedSwitchingEur)}</strong>
          </span>
          <span>
            {lang === 'ar' ? 'السقف:' : 'Legal Max:'}{' '}
            <strong>{formatEur(egressResult.maxLegalChargeEur)}</strong>
          </span>
          <span style={{ color: egressResult.illegalOverchargeEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)' }}>
            {lang === 'ar' ? 'التجاوز:' : 'Overcharge:'}{' '}
            <strong>{formatEur(egressResult.illegalOverchargeEur)}</strong>
          </span>
        </div>
      </div>

      {/* Interactive Controls Checklist */}
      <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />
          <span>{t.controlsChecklist}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {controls.map((item) => {
            const def = item.definition;
            const checked = input.implementedControls.includes(def.id);
            return (
              <label
                key={def.id}
                className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition"
                style={{
                  backgroundColor: item.applicable ? 'var(--bg-elevated)' : 'transparent',
                  borderColor: checked && item.applicable ? 'var(--accent-teal)' : 'var(--border-subtle)',
                  opacity: item.applicable ? 1 : 0.65,
                }}
              >
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={checked}
                  onChange={() => toggleControl(def.id)}
                  className="mt-0.5 shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-bold">
                    <span className="da-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-soft)' }}>
                      {def.id}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>
                      {def.article}
                    </span>
                    {!item.applicable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                        {lang === 'ar' ? 'خارج النطاق الحالي' : 'Out of scope'}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold">{lang === 'ar' ? def.titleAr : def.titleEn}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {lang === 'ar' ? item.reasonAr : item.reasonEn}
                  </div>
                </div>
                {checked && item.applicable && (
                  <CheckSquare className="w-3.5 h-3.5 shrink-0 ms-auto" style={{ color: 'var(--accent-teal)' }} />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
