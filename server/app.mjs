import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_ACT_APPLICATION_DATE,
  DATA_ACT_CONTROLS,
  DATA_ACT_PRESETS,
  DISCLAIMER_AR,
  DISCLAIMER_EN,
  EGRESS_ZERO_CHARGE_DATE,
  IOT_ACCESS_BY_DESIGN_DATE,
  assessDataActReadiness,
  auditVendorCsv,
  buildDataActBriefMarkdown,
  evaluateEgressFee,
  evaluateSwitchingClock,
} from '../src/core/index.ts';
import { openDataActDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.2.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const VALID_ROLES = new Set([
  'cloud-customer',
  'cloud-provider',
  'iot-connected-provider',
  'dual-iot-and-cloud',
]);
const VALID_CONTROL_IDS = new Set(DATA_ACT_CONTROLS.map((c) => c.id));

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function computeDigestSync(canonicalText) {
  return crypto.createHash('sha256').update(String(canonicalText || ''), 'utf8').digest('hex');
}

function makeValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendAttachment(res, contentType, filename, content) {
  const safeName = String(filename || 'download').replace(/[\r\n"\\/]/g, '') || 'download';
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buf.byteLength,
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(buf);
}

async function readJsonBody(req, maxJsonBodyBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxJsonBodyBytes) {
      const err = new Error(`JSON payload exceeds ${maxJsonBodyBytes} byte limit`);
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4217')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function pickStr(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null) return String(fallbackVal ?? '').trim();
  return String(srcVal).trim();
}

function pickIsoDate(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null || srcVal === '') {
    return String(fallbackVal || '2027-02-01');
  }
  const raw = String(srcVal).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw makeValidationError(`Invalid ISO date "${raw}". Expected YYYY-MM-DD.`);
  }
  return raw;
}

function pickNonNeg(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null || srcVal === '') return fallbackVal;
  const n = Number(srcVal);
  if (!Number.isFinite(n) || n < 0) {
    throw makeValidationError(`Expected non-negative finite number, received "${srcVal}".`);
  }
  return n;
}

function pickBool(srcVal, fallbackVal) {
  return srcVal !== undefined ? Boolean(srcVal) : Boolean(fallbackVal);
}

function mergeClockInput(patchClock, fallbackClock, rootSwitchDate) {
  const src = patchClock && typeof patchClock === 'object' ? patchClock : {};
  const wdVal =
    src.infeasibilityNoticeWorkingDays !== undefined
      ? src.infeasibilityNoticeWorkingDays === null || src.infeasibilityNoticeWorkingDays === ''
        ? null
        : pickNonNeg(src.infeasibilityNoticeWorkingDays, 0)
      : fallbackClock.infeasibilityNoticeWorkingDays;

  return {
    switchRequestDate: pickIsoDate(
      src.switchRequestDate ?? rootSwitchDate,
      fallbackClock.switchRequestDate,
    ),
    quotedNoticeDays: pickNonNeg(src.quotedNoticeDays, fallbackClock.quotedNoticeDays),
    quotedTransitionDays: pickNonNeg(src.quotedTransitionDays, fallbackClock.quotedTransitionDays),
    technicalInfeasibilityClaimed: pickBool(
      src.technicalInfeasibilityClaimed,
      fallbackClock.technicalInfeasibilityClaimed,
    ),
    infeasibilityNoticeWorkingDays: wdVal === null ? null : Math.trunc(wdVal),
    infeasibilityReason: pickStr(src.infeasibilityReason, fallbackClock.infeasibilityReason),
    quotedRetrievalDays: pickNonNeg(src.quotedRetrievalDays, fallbackClock.quotedRetrievalDays),
  };
}

function mergeEgressInput(patchEgress, fallbackEgress, rootSwitchDate) {
  const src = patchEgress && typeof patchEgress === 'object' ? patchEgress : {};
  return {
    switchRequestDate: pickIsoDate(
      src.switchRequestDate ?? rootSwitchDate,
      fallbackEgress.switchRequestDate,
    ),
    dataVolumeTb: pickNonNeg(src.dataVolumeTb, fallbackEgress.dataVolumeTb),
    egressFeePerGbEur: pickNonNeg(src.egressFeePerGbEur, fallbackEgress.egressFeePerGbEur),
    exitAdminFeeEur: pickNonNeg(src.exitAdminFeeEur, fallbackEgress.exitAdminFeeEur),
    directTechnicalCostEur: pickNonNeg(
      src.directTechnicalCostEur,
      fallbackEgress.directTechnicalCostEur,
    ),
    parallelProcessingAgreed: pickBool(
      src.parallelProcessingAgreed,
      fallbackEgress.parallelProcessingAgreed ?? false,
    ),
  };
}

function mergeAssessmentInput(patchInput, baseInput) {
  const fb = baseInput || DATA_ACT_PRESETS[0].input;
  const src = patchInput && typeof patchInput === 'object' ? patchInput : {};
  const roleRaw = pickStr(src.role, fb.role).toLowerCase();
  const rootSwitchDate = typeof src.switchRequestDate === 'string' ? src.switchRequestDate : undefined;

  const clockPatch = src.clock && typeof src.clock === 'object' ? src.clock : src;
  const egressPatch = src.egress && typeof src.egress === 'object' ? src.egress : src;

  let implementedControls = fb.implementedControls;
  if (Array.isArray(src.implementedControls)) {
    implementedControls = Array.from(
      new Set(src.implementedControls.filter((id) => VALID_CONTROL_IDS.has(id))),
    );
  }

  return {
    organizationName: pickStr(src.organizationName, fb.organizationName) || fb.organizationName,
    vendorOrProductName:
      pickStr(src.vendorOrProductName, fb.vendorOrProductName) || fb.vendorOrProductName,
    role: VALID_ROLES.has(roleRaw) ? roleRaw : fb.role,
    assessmentDate: pickIsoDate(src.assessmentDate, fb.assessmentDate),
    clock: mergeClockInput(clockPatch, fb.clock, rootSwitchDate),
    egress: mergeEgressInput(egressPatch, fb.egress, rootSwitchDate),
    implementedControls,
    vendorCsv: typeof src.vendorCsv === 'string' ? src.vendorCsv : fb.vendorCsv,
    notes: typeof src.notes === 'string' ? src.notes : fb.notes,
  };
}

function runCoreEngineSafely(fn) {
  try {
    return fn();
  } catch (err) {
    throw makeValidationError(err instanceof Error ? err.message : String(err));
  }
}

async function runCoreAssessmentSafely(input) {
  try {
    return await assessDataActReadiness(input);
  } catch (err) {
    throw makeValidationError(err instanceof Error ? err.message : String(err));
  }
}

function buildSingleVendorFallbackCsv(dossier) {
  const { input } = dossier;
  const clk = input.clock;
  const fee = input.egress;
  return [
    'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur',
    [
      JSON.stringify(input.vendorOrProductName),
      JSON.stringify(input.role),
      clk.switchRequestDate,
      clk.quotedNoticeDays,
      clk.quotedTransitionDays,
      clk.infeasibilityNoticeWorkingDays ?? '',
      Boolean(clk.technicalInfeasibilityClaimed),
      clk.quotedRetrievalDays,
      fee.dataVolumeTb,
      fee.egressFeePerGbEur,
      fee.exitAdminFeeEur,
      fee.directTechnicalCostEur,
    ].join(','),
  ].join('\n');
}

function buildExecutiveSummaryText(dossier, locale = 'en') {
  const code = dossier.dossierCode || 'DRAFT';
  const { result } = dossier;
  const fee = result.egressFee;

  if (locale === 'ar') {
    return [
      `ملخص جاهزية قانون البيانات الأوروبي (DataActKit) — ${code}`,
      `المؤسسة: ${result.organizationName} · المزود: ${result.vendorOrProductName} · الدور: ${result.role}`,
      `الجاهزية: ${result.status.toUpperCase()} (${result.readinessScore}/100) · المادة 3 (IoT >= 2026-09-12): ${result.iotAccessByDesignActive ? 'مفعّلة' : 'قبل السريان'}`,
      `حظر رسوم التبديل والخروج 0 يورو (2027-01-12): ${fee.isZeroChargeBanActive ? 'سارٍ' : 'مرحلة التكلفة المباشرة'} · التجاوز غير القانوني: EUR ${fee.illegalOverchargeEur.toFixed(2)}`,
      `تنويه: ${result.disclaimerAr}`,
    ].join('\n');
  }

  return [
    `EU Data Act Readiness Summary (DataActKit) — ${code}`,
    `Organization: ${result.organizationName} · Vendor: ${result.vendorOrProductName} · Role: ${result.role}`,
    `Readiness: ${result.status.toUpperCase()} (${result.readinessScore}/100) · IoT Art. 3 (>= 2026-09-12): ${result.iotAccessByDesignActive ? 'ACTIVE' : 'Pre-effective'}`,
    `EUR 0 Egress Ban (2027-01-12): ${fee.isZeroChargeBanActive ? 'ACTIVE' : 'Pre-2027 cost cap'} · Illegal Overcharge: EUR ${fee.illegalOverchargeEur.toFixed(2)}`,
    `Disclaimer: ${result.disclaimerEn}`,
  ].join('\n');
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html') {
    let html = fs.readFileSync(fileToServe, 'utf8');
    if (normalizedBasePath) {
      html = html
        .replaceAll('href="/', `href="${normalizedBasePath}/`)
        .replaceAll('src="/', `src="${normalizedBasePath}/`);
    }
    const baseScript = `<script>window.__DATAACTKIT_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

export function createDataActKitServer({
  dataDir,
  distDir = '',
  appOrigin = '',
  basePath = '',
  maxMutationsPerMinute = 120,
  maxJsonBodyBytes = 5 * 1024 * 1024,
}) {
  const db = openDataActDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  const rateBuckets = new Map();

  function checkRateLimit(req, method) {
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return true;
    }
    const now = Date.now();
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
        .split(',')[0]
        .trim() || '127.0.0.1';
    const windowMs = 60_000;
    const prev = rateBuckets.get(ip) || [];
    const recent = prev.filter((ts) => now - ts < windowMs);
    if (recent.length >= maxMutationsPerMinute) {
      rateBuckets.set(ip, recent);
      return false;
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    return true;
  }

  function buildPublicReportUrl(req, slugOrCode) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(slugOrCode)}`;
  }

  function findStoredDossier(id) {
    return db.getDossierById(id) || db.getDossierBySlugOrCode(id);
  }

  async function handleApiRequest(req, res, method, pathname, searchParams) {
    if (!checkRateLimit(req, method)) {
      return sendJson(res, 429, {
        error: 'Too many write requests; please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
    }

    // 1. Health & Presets
    if (method === 'GET' && pathname === '/api/health') {
      const stats = db.getStats();
      return sendJson(res, 200, {
        ok: true,
        service: 'dataactkit',
        version: APP_VERSION,
        basePath: normalizedBasePath || '/',
        ...stats,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, {
        presets: DATA_ACT_PRESETS,
        controls: DATA_ACT_CONTROLS,
        cutoffs: {
          applicationDate: DATA_ACT_APPLICATION_DATE,
          iotAccessByDesignDate: IOT_ACCESS_BY_DESIGN_DATE,
          egressZeroChargeDate: EGRESS_ZERO_CHARGE_DATE,
        },
        disclaimers: {
          en: DISCLAIMER_EN,
          ar: DISCLAIMER_AR,
        },
        sampleCsv: DATA_ACT_PRESETS[0].input.vendorCsv || '',
      });
    }

    // 2. Stateless Analyzers
    if (method === 'POST' && pathname === '/api/switching-clock') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const merged = mergeClockInput(body, DATA_ACT_PRESETS[0].input.clock, body?.switchRequestDate);
      const clockResult = runCoreEngineSafely(() => evaluateSwitchingClock(merged));
      return sendJson(res, 200, { input: merged, switchingClock: clockResult });
    }

    if (method === 'POST' && pathname === '/api/egress-fee') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const merged = mergeEgressInput(body, DATA_ACT_PRESETS[0].input.egress, body?.switchRequestDate);
      const egressResult = runCoreEngineSafely(() => evaluateEgressFee(merged));
      return sendJson(res, 200, { input: merged, egressFee: egressResult });
    }

    if (method === 'POST' && pathname === '/api/csv-audit') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const csvText = String(body?.csv ?? body?.vendorCsv ?? '');
      if (!csvText.trim()) {
        return sendJson(res, 400, { error: 'Vendor CSV payload is required', code: 'EMPTY_CSV' });
      }
      const audit = runCoreEngineSafely(() => auditVendorCsv(csvText));
      return sendJson(res, 200, {
        audit,
        exportCsv: audit.safeExportCsv,
      });
    }

    if (method === 'POST' && pathname === '/api/assess') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const basePreset = DATA_ACT_PRESETS.find((p) => p.id === body?.presetKey) || DATA_ACT_PRESETS[0];
      const inputSource = body?.input && typeof body.input === 'object' ? body.input : body;
      const input = mergeAssessmentInput(inputSource, basePreset.input);
      const result = await runCoreAssessmentSafely(input);
      return sendJson(res, 200, {
        presetKey: basePreset.id,
        input,
        result,
        sha256Digest: result.dossierSha256,
        briefMarkdownEn: buildDataActBriefMarkdown(input, result, 'DRAFT', result.dossierSha256, 'en'),
        briefMarkdownAr: buildDataActBriefMarkdown(input, result, 'DRAFT', result.dossierSha256, 'ar'),
      });
    }

    // 3. Profiles CRUD
    if (method === 'GET' && pathname === '/api/profiles') {
      return sendJson(res, 200, { profiles: db.listProfiles() });
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const profile = db.saveProfile(body || {});
      return sendJson(res, 201, { profile });
    }

    const profDeleteMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (method === 'DELETE' && profDeleteMatch) {
      const id = decodeURIComponent(profDeleteMatch[1] || '');
      const del = db.deleteProfile(id);
      if (!del.deleted) return sendJson(res, 404, { error: 'Profile not found' });
      return sendJson(res, 200, { deleted: true });
    }

    // 4. Dossiers List & Create
    if (method === 'GET' && pathname === '/api/dossiers') {
      return sendJson(res, 200, { dossiers: db.listDossiers() });
    }

    if (method === 'POST' && pathname === '/api/dossiers') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const basePreset = DATA_ACT_PRESETS.find((p) => p.id === body?.presetKey) || DATA_ACT_PRESETS[0];
      const nowIso = new Date().toISOString();
      const actor = String(body?.actor || 'dataact-coordinator').trim() || 'dataact-coordinator';
      const inputSource = body?.input && typeof body.input === 'object' ? body.input : body;
      const input = mergeAssessmentInput(inputSource, basePreset.input);
      const result = await runCoreAssessmentSafely(input);

      const bundle = db.createDossier(
        {
          presetKey: basePreset.id,
          slug:
            typeof body?.slug === 'string'
              ? body.slug
              : typeof body?.publicSlug === 'string'
                ? body.publicSlug
                : undefined,
          localeDefault: body?.localeDefault === 'ar' ? 'ar' : 'en',
          input,
          result,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        actor,
      );

      return sendJson(res, 201, {
        ...bundle,
        publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
      });
    }

    // 5. Dossier Actions: Duplicate & Finalize / Lock
    const dupMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = decodeURIComponent(dupMatch[1] || '');
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const actor = String(body?.actor || 'dataact-coordinator').trim() || 'dataact-coordinator';
      const cloned = db.duplicateDossier(id, actor);
      if (!cloned) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 201, {
        ...cloned,
        publicReportUrl: buildPublicReportUrl(req, cloned.dossier.slug),
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(finalize|lock)$/);
    if (method === 'POST' && finalizeMatch) {
      const id = decodeURIComponent(finalizeMatch[1] || '');
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const actor = String(body?.actor || 'dataact-coordinator').trim() || 'dataact-coordinator';
      const lockedBundle = db.finalizeDossier(id, computeDigestSync, actor);
      if (!lockedBundle) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 200, {
        ...lockedBundle,
        publicReportUrl: buildPublicReportUrl(
          req,
          lockedBundle.dossier.dossierCode || lockedBundle.dossier.slug,
        ),
      });
    }

    // 6. Per-Dossier Markdown Brief, Formula-Safe BOM CSV & Executive Summary
    const mdMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(?:brief|dossier)\.md$/);
    if (method === 'GET' && mdMatch) {
      const bundle = findStoredDossier(decodeURIComponent(mdMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const digest = d.sha256Digest || d.result.dossierSha256;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'dataactkit');
      return sendAttachment(
        res,
        'text/markdown; charset=utf-8',
        `dataactkit-brief-${fname}-${locale}.md`,
        buildDataActBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, locale),
      );
    }

    const csvMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export\.csv$/);
    if (method === 'GET' && csvMatch) {
      const bundle = findStoredDossier(decodeURIComponent(csvMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'dataactkit');
      const safeCsv =
        d.result.batchAudit?.safeExportCsv ?? auditVendorCsv(buildSingleVendorFallbackCsv(d)).safeExportCsv;
      return sendAttachment(res, 'text/csv; charset=utf-8', `dataactkit-${fname}.csv`, safeCsv);
    }

    const summaryMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/summary$/);
    if (method === 'GET' && summaryMatch) {
      const bundle = findStoredDossier(decodeURIComponent(summaryMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      return sendJson(res, 200, {
        locale,
        dossierCode: d.dossierCode || null,
        status: bundle.status,
        readinessStatus: d.result.status,
        readinessScore: d.result.readinessScore,
        iotAccessByDesignActive: d.result.iotAccessByDesignActive,
        egressZeroChargeActive: d.result.egressZeroChargeActive,
        illegalOverchargeEur: d.result.egressFee.illegalOverchargeEur,
        summaryText: buildExecutiveSummaryText(d, locale),
      });
    }

    // 7. Single Dossier Read, Update & Delete
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (dossierMatch) {
      const id = decodeURIComponent(dossierMatch[1] || '');
      if (method === 'GET') {
        const bundle = findStoredDossier(id);
        if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(
            req,
            bundle.dossier.dossierCode || bundle.dossier.slug,
          ),
        });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req, maxJsonBodyBytes);
        const nowIso = new Date().toISOString();

        const existing = findStoredDossier(id);
        if (!existing) return sendJson(res, 404, { error: 'Dossier not found' });
        if (existing.status === 'locked' || existing.dossier?.lockedAt) {
          return sendJson(res, 409, {
            error: 'Sealed DataActKit dossier is immutable against modification.',
            code: 'DOSSIER_LOCKED',
          });
        }

        const inputSource = patch?.input && typeof patch.input === 'object' ? patch.input : patch;
        const nextInput = mergeAssessmentInput(inputSource, existing.dossier.input);
        const nextResult = await runCoreAssessmentSafely(nextInput);

        const updated = db.updateDossier(
          id,
          (current) => {
            const requestedSlug =
              typeof patch?.slug === 'string' && patch.slug.trim()
                ? patch.slug.trim()
                : typeof patch?.publicSlug === 'string' && patch.publicSlug.trim()
                  ? patch.publicSlug.trim()
                  : current.slug;

            return {
              ...current,
              slug: requestedSlug,
              localeDefault:
                patch?.localeDefault === 'ar'
                  ? 'ar'
                  : patch?.localeDefault === 'en'
                    ? 'en'
                    : current.localeDefault,
              input: nextInput,
              result: nextResult,
              updatedAt: nowIso,
            };
          },
          String(patch?.actor || 'dataact-coordinator').trim() || 'dataact-coordinator',
        );

        if (!updated) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...updated,
          publicReportUrl: buildPublicReportUrl(req, updated.dossier.slug),
        });
      }
      if (method === 'DELETE') {
        const del = db.deleteDossier(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, { deleted: true, id: del.id });
      }
    }

    // 8. Public Shareable Report (/api/public/reports/:slugOrCode)
    const pubMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (method === 'GET' && pubMatch) {
      const slugOrCode = decodeURIComponent(pubMatch[1] || '');
      const bundle = db.getDossierBySlugOrCode(slugOrCode, { incrementView: true });
      if (!bundle) return sendJson(res, 404, { error: 'DataActKit readiness dossier not found' });
      const d = bundle.dossier;
      const digest = d.sha256Digest || d.result.dossierSha256;

      return sendJson(res, 200, {
        ...bundle,
        markdownEn: buildDataActBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, 'en'),
        markdownAr: buildDataActBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, 'ar'),
        publicReportUrl: buildPublicReportUrl(req, d.dossierCode || d.slug),
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname, parsedUrl.searchParams);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = err?.statusCode || 500;
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
