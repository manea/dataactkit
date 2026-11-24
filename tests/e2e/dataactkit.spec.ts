import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

test.describe('DataActKit — EU Data Act (2023/2854) Studio E2E', () => {
  test('defaults to EN LTR Brussels Vellum, toggles AR RTL Interconnect Slate Night, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('header')).toContainText('SQLite WAL');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'brussels-vellum');
    await expect(
      page.getByRole('img', { name: 'DataActKit Art. 25 Switching Clock and Art. 29 Egress Ceiling' }),
    ).toBeVisible();
    await expect(page.locator('main')).toContainText('Score: 100/100');
    await expect(page.locator('main')).toContainText('NOT legal counsel');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-en-brussels-vellum.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByRole('button', { name: 'العربية RTL' }).click();
    await page.getByRole('button', { name: 'لوح الربط الليلي' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'interconnect-slate');
    await expect(page.locator('main')).toContainText('ليست استشارة قانونية');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-ar-interconnect-slate.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'interconnect-slate');

    expect(errors).toEqual([]);
  });

  test('evaluates pre-2027 conditional IoT & post-2027 EUR 7,108 lock-in remediation, seals DA-YYYY-0001 with BOM CSV & /r/:code', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCode = `DA-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('main')).toContainText('100/100');

    // Preset 2: Pre-2027 Dual IoT Conditional
    await page
      .getByRole('button', { name: /Pre-2027 Dual IoT & Cloud Extended Transition/i })
      .click();
    await expect(page.locator('main')).toContainText('CONDITIONAL REVIEW');
    await expect(page.locator('main')).toContainText('ACTIVE (Access-by-Design Mandatory)');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-pre2027-iot-conditional-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Preset 3: Post-2027 EUR 7,108 Lock-In Blocked -> remediate into compliant state
    await page
      .getByRole('button', { name: /Post-2027 Cloud Lock-In & EUR 7,108/i })
      .click();
    await expect(page.locator('main')).toContainText('BLOCKED / BREACH');
    await expect(page.locator('main')).toContainText('7,108.00');

    await page.getByLabel('Contractual Notice Period (days, max 2 mo)').fill('30');
    await page.getByLabel('Mandatory Transition Window (days)').fill('30');
    await page.getByLabel('Post-Transition Retrieval Window (days, min 30d)').fill('45');
    await page.getByLabel('Quoted Egress Rate (EUR / GB)').fill('0');
    await page.getByLabel('Quoted Exit / Admin Charge (EUR)').fill('0');

    // Also update CSV batch & check remaining cloud controls so score returns to 100/100
    await page
      .locator('textarea[dir="ltr"]')
      .fill(
        'vendorName,serviceCategory,switchRequestDate,noticeDays,transitionDays,infeasibilityNoticeWorkingDays,technicalInfeasibilityClaimed,retrievalDays,dataVolumeTb,egressFeePerGbEur,exitAdminFeeEur,directTechnicalCostEur\nLegacyVault Cloud ERP,ERP Cloud,2027-02-01,30,30,,false,45,80,0,0,0',
      );
    for (const id of ['DA-ART25-01', 'DA-ART28-01', 'DA-ART29-01', 'DA-ART30-01']) {
      await page.locator(`label:has-text("${id}") input[type="checkbox"]`).check();
    }

    await expect(page.locator('main')).toContainText('READY / COMPLIANT');
    await expect(page.locator('main')).toContainText('Score: 100/100');

    // Seal dossier atomically -> DA-YYYY-0001
    await page.getByRole('button', { name: 'Seal & Stamp DA Code' }).click();
    await expect(page.locator('main')).toContainText(expectedCode);
    await expect(page.getByRole('button', { name: 'Seal & Stamp DA Code' })).toHaveCount(0);

    // Download UTF-8 BOM CSV & check EF BB BF prefix
    const dlPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Safe CSV' }).click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.csv');
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    }

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Public share route /r/:code
    await page.goto(`/r/${expectedCode}`);
    await expect(page.locator('body')).toContainText(`DataActKit — ${expectedCode}`);
    await page.reload();
    await expect(page.locator('body')).toContainText(expectedCode);

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness in EN Brussels Vellum and AR Interconnect Slate with zero overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(
      page.getByRole('img', { name: 'DataActKit Art. 25 Switching Clock and Art. 29 Egress Ceiling' }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-en-brussels-vellum.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByRole('button', { name: 'العربية RTL' }).click();
    await page.getByRole('button', { name: 'لوح الربط الليلي' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'interconnect-slate');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-ar-interconnect-slate.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
