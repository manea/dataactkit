import {
  DATA_ACT_PRESETS,
  assessDataActReadiness,
  auditVendorCsv,
  buildDataActBriefMarkdown,
  computePayloadDigest,
} from '../core/index.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { withBase } from './basePath.ts';

export type ApiMode = 'server' | 'local';

export interface StoredDossier {
  id: string;
  presetKey: string;
  slug: string;
  dossierCode: string;
  status: 'draft' | 'locked';
  localeDefault: 'en' | 'ar';
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  sha256Digest: string | null;
  viewCount: number;
  input: AssessmentInput;
  result: AssessmentResult;
}

export interface DossierBundle {
  dossier: StoredDossier;
  status: 'draft' | 'locked';
  slug: string;
  viewCount: number;
  publicReportUrl?: string;
}

export interface OrgProfile {
  id: string;
  name: string;
  profile: {
    organizationName: string;
    vendorOrProductName: string;
    role: AssessmentInput['role'];
    notes: string;
  };
  createdAt: string;
  updatedAt: string;
}

const LS_DOSSIERS = 'dataactkit.v1.dossiers';
const LS_PROFILES = 'dataactkit.v1.profiles';
const LS_SEQ = 'dataactkit.v1.seq';

function slugifyClient(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'dataact-entity'
  );
}

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function triggerTextDownload(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function detectApiMode(): Promise<ApiMode> {
  try {
    const res = await fetch(withBase('/api/health'), { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; service?: string };
      if (data?.ok && data?.service === 'dataactkit') return 'server';
    }
  } catch {
    // static browser / Cloudflare Workers offline mode
  }
  return 'local';
}

export async function listDossiers(mode: ApiMode): Promise<StoredDossier[]> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/dossiers'), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load DataActKit dossiers');
    const json = (await res.json()) as { dossiers: Array<{ dossier: StoredDossier }> };
    return json.dossiers.map((item) => item.dossier);
  }
  return readLocalList<StoredDossier>(LS_DOSSIERS);
}

export async function listProfiles(mode: ApiMode): Promise<OrgProfile[]> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/profiles'), { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { profiles: OrgProfile[] };
    return json.profiles || [];
  }
  return readLocalList<OrgProfile>(LS_PROFILES);
}

export async function saveOrgProfile(mode: ApiMode, input: AssessmentInput): Promise<OrgProfile> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/profiles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: input.organizationName,
        vendorOrProductName: input.vendorOrProductName,
        role: input.role,
        notes: input.notes || '',
      }),
    });
    const json = (await res.json()) as { profile: OrgProfile };
    return json.profile;
  }

  const now = new Date().toISOString();
  const profile: OrgProfile = {
    id: `prof-local-${Date.now().toString(36)}`,
    name: `${input.organizationName} — ${input.vendorOrProductName}`,
    profile: {
      organizationName: input.organizationName,
      vendorOrProductName: input.vendorOrProductName,
      role: input.role,
      notes: input.notes || '',
    },
    createdAt: now,
    updatedAt: now,
  };
  writeLocalList(LS_PROFILES, [profile, ...readLocalList<OrgProfile>(LS_PROFILES)]);
  return profile;
}

export async function createDossierFromInput(
  mode: ApiMode,
  input: AssessmentInput,
  localeDefault: 'en' | 'ar',
  presetKey: string = DATA_ACT_PRESETS[0]!.id,
): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/dossiers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey, input, localeDefault }),
    });
    if (!res.ok) throw new Error('Failed to create DataActKit dossier');
    return (await res.json()) as DossierBundle;
  }

  const now = new Date().toISOString();
  const id = `da-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const result = await assessDataActReadiness(input);
  const slug = `${slugifyClient(`${input.organizationName}-${input.vendorOrProductName}`)}-${id.slice(-4)}`;
  const dossier: StoredDossier = {
    id,
    presetKey,
    slug,
    dossierCode: '',
    status: 'draft',
    localeDefault,
    createdAt: now,
    updatedAt: now,
    lockedAt: null,
    sha256Digest: null,
    viewCount: 0,
    input,
    result,
  };
  writeLocalList(LS_DOSSIERS, [dossier, ...readLocalList<StoredDossier>(LS_DOSSIERS)]);
  return {
    dossier,
    status: 'draft',
    slug,
    viewCount: 0,
    publicReportUrl: `${window.location.origin}${withBase(`/r/${slug}`)}`,
  };
}

export async function updateDossierInput(
  mode: ApiMode,
  id: string,
  input: AssessmentInput,
  localeDefault: 'en' | 'ar',
): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, localeDefault }),
    });
    if (!res.ok) throw new Error('Failed to update DataActKit dossier');
    return (await res.json()) as DossierBundle;
  }

  const now = new Date().toISOString();
  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const result = await assessDataActReadiness(input);
  let target: StoredDossier | null = null;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    if (item.status === 'locked') throw new Error('Dossier is locked');
    target = { ...item, input, result, localeDefault, updatedAt: now };
    return target;
  });
  if (!target) throw new Error('Dossier not found');
  writeLocalList(LS_DOSSIERS, next);
  const found: StoredDossier = target;
  return {
    dossier: found,
    status: found.status,
    slug: found.slug,
    viewCount: found.viewCount,
    publicReportUrl: `${window.location.origin}${withBase(`/r/${found.slug}`)}`,
  };
}

export async function finalizeDossier(mode: ApiMode, id: string): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(id)}/finalize`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'dataact-web-studio' }),
    });
    if (!res.ok) throw new Error('Failed to seal DataActKit dossier');
    return (await res.json()) as DossierBundle;
  }

  const now = new Date().toISOString();
  const seq = Number(localStorage.getItem(LS_SEQ) || '0') + 1;
  localStorage.setItem(LS_SEQ, String(seq));
  const code = `DA-${new Date().getUTCFullYear()}-${String(seq).padStart(4, '0')}`;

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  let lockedTarget: StoredDossier | null = null;
  const updated: StoredDossier[] = [];
  for (const item of list) {
    if (item.id === id) {
      const digest = await computePayloadDigest(item.result.canonicalDossierText);
      lockedTarget = {
        ...item,
        status: 'locked',
        dossierCode: code,
        sha256Digest: digest,
        lockedAt: now,
        updatedAt: now,
      };
      updated.push(lockedTarget);
    } else {
      updated.push(item);
    }
  }
  if (!lockedTarget) throw new Error('Dossier not found');
  writeLocalList(LS_DOSSIERS, updated);
  return {
    dossier: lockedTarget,
    status: 'locked',
    slug: lockedTarget.slug,
    viewCount: lockedTarget.viewCount,
    publicReportUrl: `${window.location.origin}${withBase(`/r/${code}`)}`,
  };
}

export async function duplicateDossier(mode: ApiMode, id: string): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(id)}/duplicate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'dataact-web-studio' }),
    });
    if (!res.ok) throw new Error('Failed to duplicate dossier');
    return (await res.json()) as DossierBundle;
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const src = list.find((d) => d.id === id || d.slug === id || d.dossierCode === id);
  if (!src) throw new Error('Dossier not found');
  return createDossierFromInput(
    'local',
    { ...src.input, organizationName: `${src.input.organizationName} (Copy)` },
    src.localeDefault,
    src.presetKey,
  );
}

export async function deleteDraftDossier(mode: ApiMode, id: string): Promise<void> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete dossier');
    return;
  }
  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  writeLocalList(
    LS_DOSSIERS,
    list.filter((d) => d.id !== id),
  );
}

export async function loadPublicReport(
  mode: ApiMode,
  slugOrCode: string,
): Promise<(DossierBundle & { markdownEn: string; markdownAr: string }) | null> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/public/reports/${encodeURIComponent(slugOrCode)}`), {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DossierBundle & { markdownEn: string; markdownAr: string };
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const match = list.find((d) => d.slug === slugOrCode || d.dossierCode === slugOrCode || d.id === slugOrCode);
  if (!match) return null;
  const digest = match.sha256Digest || (await computePayloadDigest(match.result.canonicalDossierText));
  return {
    dossier: { ...match, viewCount: match.viewCount + 1 },
    status: match.status,
    slug: match.slug,
    viewCount: match.viewCount + 1,
    markdownEn: buildDataActBriefMarkdown(match.input, match.result, match.dossierCode || 'DRAFT', digest, 'en'),
    markdownAr: buildDataActBriefMarkdown(match.input, match.result, match.dossierCode || 'DRAFT', digest, 'ar'),
    publicReportUrl: window.location.href,
  };
}

export async function downloadBriefMarkdown(dossier: StoredDossier, lang: 'en' | 'ar'): Promise<void> {
  const digest = dossier.sha256Digest || (await computePayloadDigest(dossier.result.canonicalDossierText));
  const content = buildDataActBriefMarkdown(
    dossier.input,
    dossier.result,
    dossier.dossierCode || 'DRAFT',
    digest,
    lang,
  );
  const codePart = slugifyClient(dossier.dossierCode || dossier.slug || dossier.id);
  triggerTextDownload(`dataactkit-brief-${codePart}-${lang}.md`, 'text/markdown;charset=utf-8', content);
}

export function downloadSafeBomCsv(input: AssessmentInput, result: AssessmentResult, filenameBase = 'dataactkit'): void {
  let csv = result.batchAudit?.safeExportCsv;
  if (!csv) {
    const singleCsv = [
      'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur',
      [
        JSON.stringify(input.vendorOrProductName),
        JSON.stringify(input.role),
        input.clock.switchRequestDate,
        input.clock.quotedNoticeDays,
        input.clock.quotedTransitionDays,
        input.clock.infeasibilityNoticeWorkingDays ?? '',
        Boolean(input.clock.technicalInfeasibilityClaimed),
        input.clock.quotedRetrievalDays,
        input.egress.dataVolumeTb,
        input.egress.egressFeePerGbEur,
        input.egress.exitAdminFeeEur,
        input.egress.directTechnicalCostEur,
      ].join(','),
    ].join('\n');
    csv = auditVendorCsv(singleCsv).safeExportCsv;
  }
  triggerTextDownload(`${slugifyClient(filenameBase)}.csv`, 'text/csv;charset=utf-8', csv);
}
