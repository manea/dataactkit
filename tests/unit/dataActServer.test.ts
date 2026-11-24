import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DATA_ACT_PRESETS,
  computePayloadDigest,
  type AssessmentResult,
} from '../../src/core/index.ts';
import { createDataActKitServer } from '../../server/app.mjs';

interface StartedServer {
  baseUrl: string;
  closeAll: () => Promise<void>;
}

const cleanups: Array<() => Promise<void>> = [];

async function startTempServer(
  options: {
    basePath?: string;
    maxMutationsPerMinute?: number;
    maxJsonBodyBytes?: number;
    withFakeDist?: boolean;
  } = {},
): Promise<StartedServer> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataactkit-test-'));
  const dataDir = path.join(tempDir, 'data');
  const distDir = path.join(tempDir, 'dist');
  if (options.withFakeDist) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><script src="/assets/main.js"></script></head><body>DATAACTKIT_SPA</body></html>',
      'utf8',
    );
  }

  const { handler, close } = createDataActKitServer({
    dataDir,
    distDir: options.withFakeDist ? distDir : '',
    basePath: options.basePath ?? '',
    maxMutationsPerMinute: options.maxMutationsPerMinute ?? 120,
    maxJsonBodyBytes: options.maxJsonBodyBytes ?? 5 * 1024 * 1024,
  });

  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const prefix = options.basePath ? options.basePath.replace(/\/+$/, '') : '';
  const baseUrl = `http://127.0.0.1:${port}${prefix}`;

  const closeAll = async (): Promise<void> => {
    close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  };
  cleanups.push(closeAll);
  return { baseUrl, closeAll };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

describe('DataActKit Phase 2 SQLite WAL server', () => {
  it('serves health, BASE_PATH HTML injection, presets, stateless clock/egress/CSV checks & full assessment', async () => {
    const srv = await startTempServer({ basePath: '/dataactkit', withFakeDist: true });

    const healthRes = await fetch(`${srv.baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as Record<string, unknown>;
    expect(health.ok).toBe(true);
    expect(health.service).toBe('dataactkit');
    expect(String(health.version)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(health.basePath).toBe('/dataactkit');

    const htmlRes = await fetch(`${srv.baseUrl}/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__DATAACTKIT_BASE__="/dataactkit"');
    expect(html).toContain('src="/dataactkit/assets/main.js"');

    const presetsRes = await fetch(`${srv.baseUrl}/api/presets`);
    expect(presetsRes.status).toBe(200);
    const presetsJson = (await presetsRes.json()) as {
      presets: unknown[];
      controls: unknown[];
      cutoffs: { iotAccessByDesignDate: string; egressZeroChargeDate: string };
      sampleCsv: string;
    };
    expect(presetsJson.presets).toHaveLength(3);
    expect(presetsJson.controls).toHaveLength(7);
    expect(presetsJson.cutoffs.iotAccessByDesignDate).toBe('2026-09-12');
    expect(presetsJson.cutoffs.egressZeroChargeDate).toBe('2027-01-12');
    expect(presetsJson.sampleCsv).toContain('EuroCloud Object & Compute');

    // Stateless switching clock check (14 working days deadline check)
    const clockRes = await fetch(`${srv.baseUrl}/api/switching-clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        switchRequestDate: '2026-11-16',
        quotedNoticeDays: 30,
        quotedTransitionDays: 120,
        technicalInfeasibilityClaimed: true,
        infeasibilityNoticeWorkingDays: 10,
        infeasibilityReason: 'Encrypted sharded ledger migration across EU regions',
        quotedRetrievalDays: 30,
      }),
    });
    expect(clockRes.status).toBe(200);
    const clockJson = (await clockRes.json()) as {
      switchingClock: {
        status: string;
        infeasibilityNoticeDeadlineDate: string;
        infeasibilityNoticeCompliant: boolean;
      };
    };
    expect(clockJson.switchingClock.status).toBe('conditional');
    expect(clockJson.switchingClock.infeasibilityNoticeDeadlineDate).toBe('2026-12-04');
    expect(clockJson.switchingClock.infeasibilityNoticeCompliant).toBe(true);

    // Stateless egress fee check on post-2027 80TB overcharge = 7108 EUR
    const egressRes = await fetch(`${srv.baseUrl}/api/egress-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        switchRequestDate: '2027-02-01',
        dataVolumeTb: 80,
        egressFeePerGbEur: 0.08,
        exitAdminFeeEur: 554.4,
        directTechnicalCostEur: 4000,
      }),
    });
    expect(egressRes.status).toBe(200);
    const egressJson = (await egressRes.json()) as {
      egressFee: { illegalOverchargeEur: number; status: string; isZeroChargeBanActive: boolean };
    };
    expect(egressJson.egressFee.isZeroChargeBanActive).toBe(true);
    expect(egressJson.egressFee.illegalOverchargeEur).toBe(7108);
    expect(egressJson.egressFee.status).toBe('blocked');

    // Empty CSV 400 + dangerous CSV formula escaping with UTF-8 BOM
    const emptyCsvRes = await fetch(`${srv.baseUrl}/api/csv-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: '   ' }),
    });
    expect(emptyCsvRes.status).toBe(400);

    const dangerousCsv = [
      'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur',
      '=CMD|calc,Cloud,2027-02-01,90,30,30,10,0.10,50,0',
    ].join('\n');
    const csvAuditRes = await fetch(`${srv.baseUrl}/api/csv-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: dangerousCsv }),
    });
    expect(csvAuditRes.status).toBe(200);
    const csvAuditJson = (await csvAuditRes.json()) as {
      audit: { blockedCount: number; totalIllegalOverchargeEur: number };
      exportCsv: string;
    };
    expect(csvAuditJson.audit.blockedCount).toBe(1);
    expect(csvAuditJson.audit.totalIllegalOverchargeEur).toBe(1074);
    expect(csvAuditJson.exportCsv.startsWith('\uFEFF')).toBe(true);
    expect(csvAuditJson.exportCsv).toContain('"\'=CMD|calc"');

    // Full stateless assessment
    const assessRes = await fetch(`${srv.baseUrl}/api/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: DATA_ACT_PRESETS[2]!.id }),
    });
    expect(assessRes.status).toBe(200);
    const assessJson = (await assessRes.json()) as {
      result: AssessmentResult;
      sha256Digest: string;
      briefMarkdownEn: string;
      briefMarkdownAr: string;
    };
    expect(assessJson.result.status).toBe('blocked');
    expect(assessJson.result.egressFee.illegalOverchargeEur).toBe(7108);
    expect(assessJson.sha256Digest).toMatch(/^[a-f0-9]{64}$/);
    expect(assessJson.briefMarkdownEn).toContain('NOT legal counsel');
    expect(assessJson.briefMarkdownAr).toContain('ليست استشارة قانونية');
  });

  it('persists profiles & dossiers in SQLite WAL, stamps atomic DA-YYYY-0001, enforces 409 lock, and serves exports + views', async () => {
    const srv = await startTempServer({ basePath: '/dataactkit' });

    const profRes = await fetch(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Alpine FinOps SA',
        vendorOrProductName: 'EuroHost Kubernetes',
        role: 'cloud-customer',
        notes: 'Core EU sovereign cluster',
      }),
    });
    expect(profRes.status).toBe(201);
    const profList = (await (await fetch(`${srv.baseUrl}/api/profiles`)).json()) as {
      profiles: Array<{ id: string; profile: { organizationName: string } }>;
    };
    expect(profList.profiles).toHaveLength(1);
    expect(profList.profiles[0]!.profile.organizationName).toBe('Alpine FinOps SA');

    const delProfRes = await fetch(`${srv.baseUrl}/api/profiles/${profList.profiles[0]!.id}`, {
      method: 'DELETE',
    });
    expect(delProfRes.status).toBe(200);

    // Create blocked preset dossier
    const createRes = await fetch(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: DATA_ACT_PRESETS[2]!.id, localeDefault: 'ar' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      dossier: { id: string; slug: string; result: AssessmentResult };
      status: string;
    };
    expect(created.status).toBe('draft');
    expect(created.dossier.result.status).toBe('blocked');
    expect(created.dossier.result.egressFee.illegalOverchargeEur).toBe(7108);

    // Remediate blocked dossier into ready state via PATCH
    const patchRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotedNoticeDays: 30,
        quotedTransitionDays: 30,
        quotedRetrievalDays: 45,
        egressFeePerGbEur: 0,
        exitAdminFeeEur: 0,
        directTechnicalCostEur: 0,
        implementedControls: ['DA-ART25-01', 'DA-ART26-01', 'DA-ART28-01', 'DA-ART29-01', 'DA-ART30-01'],
        vendorCsv: DATA_ACT_PRESETS[0]!.input.vendorCsv,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      dossier: { result: AssessmentResult };
    };
    expect(patched.dossier.result.status).toBe('ready');
    expect(patched.dossier.result.readinessScore).toBe(100);
    expect(patched.dossier.result.egressFee.illegalOverchargeEur).toBe(0);

    // Finalize atomically to DA-YYYY-0001
    const finalizeRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'finops-lead' }),
    });
    expect(finalizeRes.status).toBe(200);
    const locked = (await finalizeRes.json()) as {
      status: string;
      dossier: {
        dossierCode: string;
        sha256Digest: string;
        result: AssessmentResult;
      };
    };
    const year = new Date().getUTCFullYear();
    expect(locked.status).toBe('locked');
    expect(locked.dossier.dossierCode).toBe(`DA-${year}-0001`);
    const clientDigest = await computePayloadDigest(locked.dossier.result.canonicalDossierText);
    expect(locked.dossier.sha256Digest).toBe(clientDigest);

    // 409 immutability guards
    const lockedPatch = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exitAdminFeeEur: 500 }),
    });
    expect(lockedPatch.status).toBe(409);

    const lockedDel = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'DELETE',
    });
    expect(lockedDel.status).toBe(409);

    const relock = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(relock.status).toBe(409);

    // Duplicate & delete editable draft
    const dupRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(dupRes.status).toBe(201);
    const dupJson = (await dupRes.json()) as { status: string; dossier: { id: string } };
    expect(dupJson.status).toBe('draft');
    const delDup = await fetch(`${srv.baseUrl}/api/dossiers/${dupJson.dossier.id}`, {
      method: 'DELETE',
    });
    expect(delDup.status).toBe(200);

    // Exports & public share view counter
    const mdRes = await fetch(
      `${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/brief.md?locale=ar`,
    );
    expect(mdRes.status).toBe(200);
    const mdText = await mdRes.text();
    expect(mdText).toContain(locked.dossier.dossierCode);
    expect(mdText).toContain('قانون البيانات الأوروبي');

    const csvRes = await fetch(`${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/export.csv`);
    expect(csvRes.status).toBe(200);
    const csvBuf = Buffer.from(await csvRes.arrayBuffer());
    expect(csvBuf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
    expect(csvBuf.toString('utf8')).toContain('EuroCloud Object & Compute');

    const sumRes = await fetch(
      `${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/summary?locale=en`,
    );
    expect(sumRes.status).toBe(200);
    const sumJson = (await sumRes.json()) as {
      summaryText: string;
      egressZeroChargeActive: boolean;
      illegalOverchargeEur: number;
    };
    expect(sumJson.egressZeroChargeActive).toBe(true);
    expect(sumJson.illegalOverchargeEur).toBe(0);
    expect(sumJson.summaryText).toContain(locked.dossier.dossierCode);
    expect(sumJson.summaryText).toContain('NOT legal counsel');

    const pubRes = await fetch(`${srv.baseUrl}/api/public/reports/${locked.dossier.dossierCode}`);
    expect(pubRes.status).toBe(200);
    const pubJson = (await pubRes.json()) as {
      viewCount: number;
      markdownEn: string;
      markdownAr: string;
    };
    expect(pubJson.viewCount).toBe(1);
    expect(pubJson.markdownEn).toContain(locked.dossier.sha256Digest);
    expect(pubJson.markdownAr).toContain('DataActKit');
  });

  it('enforces 413 payload limits and 429 mutation throttling', async () => {
    const smallLimitSrv = await startTempServer({ maxJsonBodyBytes: 64 });
    const hugeRes = await fetch(`${smallLimitSrv.baseUrl}/api/egress-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(200) }),
    });
    expect(hugeRes.status).toBe(413);

    const rateSrv = await startTempServer({ maxMutationsPerMinute: 2 });
    const r1 = await fetch(`${rateSrv.baseUrl}/api/egress-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const r2 = await fetch(`${rateSrv.baseUrl}/api/egress-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const r3 = await fetch(`${rateSrv.baseUrl}/api/egress-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });
});
