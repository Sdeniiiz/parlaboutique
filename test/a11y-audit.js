const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const AXE_PATH = path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');

async function runA11yAudit() {
  console.log('\n--- [3] ERİŞİLEBİLİRLİK (A11Y) DENETİMİ (AXE-CORE & WCAG 2.1 AA) ---');
  let failures = [];
  let passes = 0;

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    browser = await chromium.launch({ headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Inject axe-core
  const axeScript = fs.readFileSync(AXE_PATH, 'utf8');
  await page.evaluate(axeScript);

  // Run axe audit on homepage
  const results = await page.evaluate(async () => {
    return await axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
      }
    });
  });

  const criticalAndSerious = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  const moderateAndMinor = results.violations.filter(v => v.impact === 'moderate' || v.impact === 'minor');

  console.log(`  ✔ Kontrol Edilen WCAG Kuralları: ${results.passes.length} adet erişilebilirlik kuralı başarıyla geçti`);
  passes++;

  if (criticalAndSerious.length === 0) {
    console.log('  ✔ Kritik ve Ciddi Seviye A11y İhlali: 0 (Temiz)');
    passes++;
  } else {
    criticalAndSerious.forEach(v => {
      failures.push(`[${v.impact.toUpperCase()}] ${v.help} (${v.id}) - Etkilenen öğe: ${v.nodes[0] ? v.nodes[0].html : ''}`);
      console.error(`  ✖ [${v.impact.toUpperCase()}] ${v.help} (${v.id})`);
    });
  }

  if (moderateAndMinor.length > 0) {
    console.log(`  ℹ Orta / Düşük Seviye A11y Uyarısı: ${moderateAndMinor.length} adet (İnceleniyor...)`);
    moderateAndMinor.forEach(v => {
      console.log(`     - [${v.impact}] ${v.help} (${v.id}): ${v.nodes.length} öğe`);
    });
  }

  // Also test accessibility inside product modal
  const firstCard = await page.$('.product-card .product-media');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(400);

    const modalResults = await page.evaluate(async () => {
      const modalEl = document.getElementById('productModalContent');
      return await axe.run(modalEl, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      });
    });

    const modalCritical = modalResults.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    if (modalCritical.length === 0) {
      console.log('  ✔ Ürün Modalı A11y: Kritik ve ciddi ihlal yok');
      passes++;
    } else {
      modalCritical.forEach(v => {
        failures.push(`[MODAL-${v.impact.toUpperCase()}] ${v.help} (${v.id})`);
      });
    }
  }

  await browser.close();

  console.log(`Erişilebilirlik Denetim Sonucu: ${passes} Başarılı, ${failures.length} Başarısız`);
  return failures.length === 0;
}

if (require.main === module) {
  runA11yAudit().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runA11yAudit };
