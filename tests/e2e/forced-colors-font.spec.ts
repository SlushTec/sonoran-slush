import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) for (const forcedColors of ['none', 'active'] as const) {
  test(`selected font remains distinct from keyboard focus ${width} ${forcedColors}`, async ({ page, baseURL }) => {
    let outside = 0;
    await page.route('**/*', route => { if (new URL(route.request().url()).origin === new URL(baseURL!).origin) return route.continue(); outside++; return route.abort(); });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ forcedColors, reducedMotion: 'reduce' });
    await page.goto('/products/makertwist-40oz-tumbler');
    await page.getByRole('button', { name: 'Add your personal touch' }).click();
    const fonts = page.locator('.font-picker button');
    const modern = page.getByRole('button', { name: 'Modern sans', exact: false });
    const text = page.getByLabel('Name, initials, or message', { exact: false });
    const initial = await fonts.evaluateAll(es => es.map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })));
    await modern.focus(); await page.keyboard.press('Enter'); await text.focus();
    await expect(modern).toHaveAttribute('aria-pressed', 'true');
    const states = await fonts.evaluateAll(es => es.map(e => { const s = getComputedStyle(e); return { pressed: e.getAttribute('aria-pressed'), style: s.borderStyle, border: s.borderWidth, outline: s.outlineStyle, bg: s.backgroundColor, color: s.color, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }; }));
    expect(states.map(x => x.pressed)).toEqual(['false', 'true', 'false']);
    expect(states.map(x => ({ width: x.width, height: x.height }))).toEqual(initial);
    if (forcedColors === 'active') {
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
      expect(states[1].style).toBe('double'); expect(states[1].border).toBe('3px');
      expect(states[0].style).toBe('solid'); expect(states[0].border).toBe('1px');
      expect(states[2].style).toBe('solid'); expect(states[2].border).toBe('1px');
    } else {
      expect(states.every(x => x.style === 'solid' && x.border === '1px')).toBe(true);
      expect(states[1].bg).not.toBe(states[0].bg);
    }
    // Moving focus is not selection. Selected double border and unselected focus outline coexist.
    await fonts.nth(2).focus();
    await expect(modern).toHaveAttribute('aria-pressed', 'true');
    expect(await fonts.nth(2).evaluate(e => getComputedStyle(e).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(modern).toHaveAttribute('aria-pressed', 'false');
    await expect(fonts.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await text.focus();
    if (forcedColors === 'active') {
      expect(await fonts.nth(2).evaluate(e => getComputedStyle(e).borderStyle)).toBe('double');
      expect(await modern.evaluate(e => getComputedStyle(e).borderStyle)).toBe('solid');
    }
    expect(outside).toBe(0);
    await page.screenshot({ path: test.info().outputPath('selected-font-viewport.png') });
  });
}
