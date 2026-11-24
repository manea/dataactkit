import { evaluateEgressFee } from './egressFeeEngine.ts';
import { evaluateSwitchingClock } from './switchingClockEngine.ts';
import type { CsvBatchAuditResult, ReadinessStatus, VendorCsvRowResult } from './types.ts';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) and formats RFC 4180 CSV cells cleanly.
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const cleaned = raw.replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ');
  const needsFormulaEscape = /^[\s\t]*[=+\-@]/.test(cleaned) || /^[\t\r]/.test(cleaned);
  const safe = needsFormulaEscape ? `'${cleaned}` : cleaned;
  if (/[",]/.test(safe) || safe.startsWith("'") || safe !== safe.trim()) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  if (semiCount > commaCount && semiCount >= tabCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function parseOptionalInt(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;
  const num = Number(value.trim());
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function parseNum(value: string | undefined, fallback = 0): number {
  if (!value || !value.trim()) return fallback;
  const num = Number(value.trim());
  if (!Number.isFinite(num)) {
    throw new Error(`Expected numeric CSV value, got "${value}".`);
  }
  return num;
}

function combineStatuses(a: ReadinessStatus, b: ReadinessStatus): ReadinessStatus {
  if (a === 'blocked' || b === 'blocked') return 'blocked';
  if (a === 'conditional' || b === 'conditional') return 'conditional';
  return 'ready';
}

export function auditVendorCsv(csvText: string): CsvBatchAuditResult {
  const stripped = csvText.replace(/^\uFEFF/, '');
  const lines = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      totalVendors: 0,
      readyCount: 0,
      conditionalCount: 0,
      blockedCount: 0,
      parseWarnings: ['Empty CSV payload; zero vendor rows audited.'],
      totalQuotedSwitchingEur: 0,
      totalIllegalOverchargeEur: 0,
      vendors: [],
      safeExportCsv: '\uFEFF' + ['vendorName,serviceCategory,switchRequestDate,status,totalQuotedSwitchingEur,maxLegalChargeEur,illegalOverchargeEur,noticeCompliant,transitionCompliant,retrievalCompliant,findingsSummary'].join('\n') + '\n',
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headerKeys = rawHeaders.map(normalizeKey);
  const parseWarnings: string[] = [];
  const vendors: VendorCsvRowResult[] = [];

  const getCol = (rowMap: Record<string, string>, aliases: string[]): string | undefined => {
    for (const alias of aliases) {
      if (alias in rowMap) return rowMap[alias];
    }
    return undefined;
  };

  for (let idx = 1; idx < lines.length; idx += 1) {
    const cells = parseCsvLine(lines[idx], delimiter);
    const rowMap: Record<string, string> = {};
    headerKeys.forEach((key, colIdx) => {
      rowMap[key] = cells[colIdx] ?? '';
    });

    const vendorName =
      getCol(rowMap, ['vendorname', 'vendor', 'provider', 'supplier']) || `Row-${idx}`;
    const serviceCategory =
      getCol(rowMap, ['servicecategory', 'category', 'service']) || 'Cloud / SaaS';
    const switchRequestDate =
      getCol(rowMap, ['switchrequestdate', 'switchdate', 'requestdate']) || '';

    try {
      const clock = evaluateSwitchingClock({
        switchRequestDate,
        quotedNoticeDays: parseNum(getCol(rowMap, ['noticedays', 'quotednoticedays']), 30),
        quotedTransitionDays: parseNum(getCol(rowMap, ['transitiondays', 'quotedtransitiondays']), 30),
        technicalInfeasibilityClaimed: parseBool(
          getCol(rowMap, ['technicalinfeasibilityclaimed', 'infeasibilityclaimed', 'extended']),
        ),
        infeasibilityNoticeWorkingDays: parseOptionalInt(
          getCol(rowMap, ['infeasibilitynoticeworkingdays', 'infeasibilitynoticewd']),
        ),
        infeasibilityReason:
          getCol(rowMap, ['infeasibilityreason', 'reason']) ??
          'Documented multi-tenant re-architecture milestone.',
        quotedRetrievalDays: parseNum(getCol(rowMap, ['retrievaldays', 'quotedretrievaldays']), 30),
      });

      const egress = evaluateEgressFee({
        switchRequestDate,
        dataVolumeTb: parseNum(getCol(rowMap, ['datavolumetb', 'volumetb']), 0),
        egressFeePerGbEur: parseNum(getCol(rowMap, ['egressfeepergbeur', 'egresspergb']), 0),
        exitAdminFeeEur: parseNum(getCol(rowMap, ['exitadminfeeeur', 'adminfeeeur']), 0),
        directTechnicalCostEur: parseNum(getCol(rowMap, ['directtechnicalcosteur', 'directcosteur']), 0),
      });

      vendors.push({
        rowNumber: idx,
        vendorName,
        serviceCategory,
        switchRequestDate: clock.normalizedRequestDate,
        status: combineStatuses(clock.status, egress.status),
        totalQuotedSwitchingEur: egress.totalQuotedSwitchingEur,
        maxLegalChargeEur: egress.maxLegalChargeEur,
        illegalOverchargeEur: egress.illegalOverchargeEur,
        noticeCompliant: clock.noticeCompliant,
        transitionCompliant: clock.transitionCompliant,
        retrievalCompliant: clock.retrievalCompliant,
        findings: [...clock.findings, ...egress.findings],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parseWarnings.push(`Row ${idx} (${vendorName}): ${msg}`);
    }
  }

  let readyCount = 0;
  let conditionalCount = 0;
  let blockedCount = 0;
  let totalQuotedSwitchingEur = 0;
  let totalIllegalOverchargeEur = 0;

  for (const v of vendors) {
    if (v.status === 'ready') readyCount += 1;
    else if (v.status === 'conditional') conditionalCount += 1;
    else blockedCount += 1;
    totalQuotedSwitchingEur += v.totalQuotedSwitchingEur;
    totalIllegalOverchargeEur += v.illegalOverchargeEur;
  }

  const headerRow = [
    'vendorName',
    'serviceCategory',
    'switchRequestDate',
    'status',
    'totalQuotedSwitchingEur',
    'maxLegalChargeEur',
    'illegalOverchargeEur',
    'noticeCompliant',
    'transitionCompliant',
    'retrievalCompliant',
    'findingsSummary',
  ].join(',');

  const bodyRows = vendors.map((v) => {
    const findingsSummary =
      v.findings.length === 0 ? 'OK' : v.findings.map((f) => `[${f.code}] ${f.messageEn}`).join(' | ');
    return [
      sanitizeCsvCell(v.vendorName),
      sanitizeCsvCell(v.serviceCategory),
      sanitizeCsvCell(v.switchRequestDate),
      sanitizeCsvCell(v.status),
      sanitizeCsvCell(v.totalQuotedSwitchingEur.toFixed(2)),
      sanitizeCsvCell(v.maxLegalChargeEur.toFixed(2)),
      sanitizeCsvCell(v.illegalOverchargeEur.toFixed(2)),
      sanitizeCsvCell(v.noticeCompliant),
      sanitizeCsvCell(v.transitionCompliant),
      sanitizeCsvCell(v.retrievalCompliant),
      sanitizeCsvCell(findingsSummary),
    ].join(',');
  });

  const safeExportCsv = '\uFEFF' + [headerRow, ...bodyRows].join('\n') + '\n';

  return {
    totalVendors: vendors.length,
    readyCount,
    conditionalCount,
    blockedCount,
    parseWarnings,
    totalQuotedSwitchingEur: round2(totalQuotedSwitchingEur),
    totalIllegalOverchargeEur: round2(totalIllegalOverchargeEur),
    vendors,
    safeExportCsv,
  };
}
