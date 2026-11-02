/**
 * PARLA BOUTİQUE - Preflight Master Test Suite
 * Comprehensive automated testing covering:
 * 1. Syntax & Schema Integrity
 * 2. Technical SEO Audit
 * 3. Multi-Device Responsiveness (320px - 1920px)
 * 4. Accessibility (axe-core WCAG 2.1 AA)
 * 5. Functional Flows & QA Tests
 * 6. Lighthouse CI Quality & Performance
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { runSeoAudit } = require('./seo-audit');
const { runDeviceResponsiveAudit } = require('./device-responsive');
const { runA11yAudit } = require('./a11y-audit');
const { runFunctionalAudit } = require('./functional');
const { runLighthouseAudit } = require('./lighthouse-audit');

async function runPreflight() {
  console.log('===========================================================');
  console.log('   PARLA BOUTİQUE (parlaboutiqesamsun) PREFLIGHT SUITE    ');
  console.log('   Canlıya Hazırlık Otomatik Doğrulama ve Test Sistemi     ');
  console.log('===========================================================\n');

  const startTime = Date.now();
  const summary = {
    syntax: false,
    seo: false,
    responsive: false,
    a11y: false,
    functional: false,
    lighthouse: false
  };

  // [STEP 1] Syntax & Schema Integrity Check
  console.log('--- [1] SÖZDİZİMİ VE VERİ BÜTÜNLÜĞÜ DENETİMİ ---');
  try {
    execSync('node -c server.js', { stdio: 'pipe' });
    execSync('node -c public/js/app.js', { stdio: 'pipe' });
    const productsRaw = fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf-8');
    const productsData = JSON.parse(productsRaw);
    if (!Array.isArray(productsData.products) || !Array.isArray(productsData.categories)) {
      throw new Error('products.json şeması geçersiz!');
    }
    console.log(`  ✔ server.js & public/js/app.js sözdizimi geçerli`);
    console.log(`  ✔ data/products.json geçerli (${productsData.products.length} ürün, ${productsData.categories.length} kategori)`);
    summary.syntax = true;
  } catch (err) {
    console.error('  ✖ Sözdizimi / Veri bütünlüğü hatası:', err.message);
  }

  // [STEP 2] Technical SEO Audit
  try {
    summary.seo = await runSeoAudit();
  } catch (err) {
    console.error('  ✖ SEO denetimi sırasında hata:', err.message);
  }

  // [STEP 3] Multi-Device Responsiveness (320px - 1920px)
  try {
    summary.responsive = await runDeviceResponsiveAudit();
  } catch (err) {
    console.error('  ✖ Mobil/Cihaz denetimi sırasında hata:', err.message);
  }

  // [STEP 4] Accessibility Audit (axe-core WCAG 2.1 AA)
  try {
    summary.a11y = await runA11yAudit();
  } catch (err) {
    console.error('  ✖ Erişilebilirlik denetimi sırasında hata:', err.message);
  }

  // [STEP 5] Functional QA Flows
  try {
    summary.functional = await runFunctionalAudit();
  } catch (err) {
    console.error('  ✖ Fonksiyonel akış denetimi sırasında hata:', err.message);
  }

  // [STEP 6] Lighthouse CI Quality & Performance
  try {
    const lhResult = await runLighthouseAudit();
    summary.lighthouse = lhResult.success;
  } catch (err) {
    console.error('  ✖ Lighthouse denetimi sırasında hata:', err.message);
  }

  // FINAL SUMMARY
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n===========================================================');
  console.log(`   PREFLIGHT SONUÇ ÖZETİ (${elapsed} sn)`);
  console.log('===========================================================');
  console.log(`  [1] Sözdizimi & Veri Bütünlüğü: ${summary.syntax ? '✔ BAŞARILI' : '✖ BAŞARISIZ'}`);
  console.log(`  [2] Teknik SEO Denetimi:        ${summary.seo ? '✔ BAŞARILI (11/11)' : '✖ BAŞARISIZ'}`);
  console.log(`  [3] Mobil & Cihaz Uyumluluğu:   ${summary.responsive ? '✔ BAŞARILI (8 Çözünürlük, 0 Taşma)' : '✖ BAŞARISIZ'}`);
  console.log(`  [4] Erişilebilirlik (axe-core): ${summary.a11y ? '✔ BAŞARILI (0 Kritik İhlal)' : '✖ BAŞARISIZ'}`);
  console.log(`  [5] Fonksiyonel QA & Akışlar:   ${summary.functional ? '✔ BAŞARILI (10/10 Test)' : '✖ BAŞARISIZ'}`);
  console.log(`  [6] Lighthouse CI Denetimi:     ${summary.lighthouse ? '✔ BAŞARILI (Mobil Simülasyon)' : '✖ BAŞARISIZ'}`);

  const allPassed = Object.values(summary).every(Boolean);
  console.log('-----------------------------------------------------------');
  console.log(`GENEL DURUM: ${allPassed ? '🚀 TÜM TESTLER BAŞARIYLA GEÇTİ (YAYINA HAZIR)' : '⚠️ HATALAR BULUNDU'}`);
  console.log('===========================================================\n');

  return allPassed;
}

if (require.main === module) {
  runPreflight().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

module.exports = { runPreflight };
