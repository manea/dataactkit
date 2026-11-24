import { BookmarkPlus, Building2, Clock } from 'lucide-react';
import type { AssessmentInput, DataActRole, SwitchingClockResult } from '../core/types.ts';
import type { OrgProfile } from '../lib/api.ts';
import { ROLE_LABELS, UI_LABELS, isolateLtr, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  clockResult: SwitchingClockResult;
  profiles: OrgProfile[];
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
  onSaveProfile: () => void;
}

export function ScopeAndClockPanel({
  lang,
  input,
  clockResult,
  profiles,
  locked,
  onChange,
  onSaveProfile,
}: Props) {
  const t = UI_LABELS[lang];
  const clk = input.clock;

  const updateClock = (patch: Partial<AssessmentInput['clock']>) => {
    const nextClock = { ...clk, ...patch };
    const nextEgress =
      patch.switchRequestDate !== undefined
        ? { ...input.egress, switchRequestDate: patch.switchRequestDate }
        : input.egress;
    onChange({ ...input, clock: nextClock, egress: nextEgress });
  };

  return (
    <section className="da-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <span>{t.scopeTitle}</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.scopeSub}
          </p>
        </div>

        <button
          type="button"
          onClick={onSaveProfile}
          disabled={locked}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>{t.saveProfile}</span>
        </button>
      </div>

      {profiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span style={{ color: 'var(--text-secondary)' }}>{t.savedProfiles}:</span>
          {profiles.slice(0, 4).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={locked}
              onClick={() =>
                onChange({
                  ...input,
                  organizationName: p.profile.organizationName,
                  vendorOrProductName: p.profile.vendorOrProductName,
                  role: p.profile.role,
                  notes: p.profile.notes || input.notes,
                })
              }
              className="px-2.5 py-1 rounded-full border transition cursor-pointer disabled:opacity-50"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
            >
              {p.profile.organizationName}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.organizationName}
          </span>
          <input
            type="text"
            className="da-input"
            disabled={locked}
            value={input.organizationName}
            onChange={(e) => onChange({ ...input, organizationName: e.target.value })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.vendorOrProductName}
          </span>
          <input
            type="text"
            className="da-input"
            disabled={locked}
            value={input.vendorOrProductName}
            onChange={(e) => onChange({ ...input, vendorOrProductName: e.target.value })}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t.roleLabel}
          </span>
          <select
            className="da-input"
            disabled={locked}
            value={input.role}
            onChange={(e) => onChange({ ...input, role: e.target.value as DataActRole })}
          >
            {(Object.keys(ROLE_LABELS) as DataActRole[]).map((rk) => (
              <option key={rk} value={rk}>
                {ROLE_LABELS[rk][lang]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t.assessmentDate}
            </span>
            <input
              type="date"
              className="da-input da-mono"
              disabled={locked}
              value={input.assessmentDate}
              onChange={(e) => onChange({ ...input, assessmentDate: e.target.value })}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t.switchRequestDate}
            </span>
            <input
              type="date"
              className="da-input da-mono"
              disabled={locked}
              value={clk.switchRequestDate}
              onChange={(e) => updateClock({ switchRequestDate: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="pt-2 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--accent-teal)' }} />
            <span>
              {lang === 'ar'
                ? `حد الإشعار الأقصى: ${isolateLtr(clockResult.maxLegalNoticeEndDate)} · حد الانتقال: ${isolateLtr(`${clockResult.maxAllowedTransitionDays}d`)}`
                : `Max Notice: ${clockResult.maxLegalNoticeEndDate} · Max Transition: ${clockResult.maxAllowedTransitionDays}d`}
            </span>
          </span>
          <span
            className="px-2 py-0.5 rounded-full da-mono text-[11px]"
            style={{
              backgroundColor:
                clockResult.status === 'ready'
                  ? 'var(--accent-teal-soft)'
                  : clockResult.status === 'conditional'
                    ? 'var(--accent-amber-soft)'
                    : 'var(--accent-crimson-soft)',
              color:
                clockResult.status === 'ready'
                  ? 'var(--accent-teal)'
                  : clockResult.status === 'conditional'
                    ? 'var(--accent-amber)'
                    : 'var(--accent-crimson)',
            }}
          >
            {clockResult.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t.quotedNoticeDays}
            </span>
            <input
              type="number"
              min={0}
              className="da-input da-mono num-tabular"
              disabled={locked}
              value={clk.quotedNoticeDays}
              onChange={(e) => updateClock({ quotedNoticeDays: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t.quotedTransitionDays}
            </span>
            <input
              type="number"
              min={0}
              className="da-input da-mono num-tabular"
              disabled={locked}
              value={clk.quotedTransitionDays}
              onChange={(e) => updateClock({ quotedTransitionDays: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t.quotedRetrievalDays}
            </span>
            <input
              type="number"
              min={0}
              className="da-input da-mono num-tabular"
              disabled={locked}
              value={clk.quotedRetrievalDays}
              onChange={(e) => updateClock({ quotedRetrievalDays: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            disabled={locked}
            checked={clk.technicalInfeasibilityClaimed}
            onChange={(e) =>
              updateClock({
                technicalInfeasibilityClaimed: e.target.checked,
                infeasibilityNoticeWorkingDays: e.target.checked
                  ? clk.infeasibilityNoticeWorkingDays ?? 10
                  : null,
              })
            }
            className="mt-0.5"
          />
          <span>{t.infeasibilityClaimed}</span>
        </label>

        {clk.technicalInfeasibilityClaimed && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
            <label className="space-y-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t.infeasibilityWd}
              </span>
              <input
                type="number"
                min={0}
                className="da-input da-mono num-tabular"
                disabled={locked}
                value={clk.infeasibilityNoticeWorkingDays ?? 0}
                onChange={(e) =>
                  updateClock({
                    infeasibilityNoticeWorkingDays: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                  })
                }
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t.infeasibilityReason}
              </span>
              <input
                type="text"
                className="da-input"
                disabled={locked}
                value={clk.infeasibilityReason}
                onChange={(e) => updateClock({ infeasibilityReason: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
