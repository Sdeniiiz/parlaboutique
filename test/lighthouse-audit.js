const { chromium } = require('playwright');
const lighthouse = require('lighthouse').default || require('lighthouse');

async function runLighthouseAudit(url = 'http://localhost:3000') {
  console.log('\n--- [5] LIGHTHOUSE CI KALİTE VE PERFORMANS DENETİMİ ---');
  
  const browser = await chromium.launch({
    args: ['--remote-debugging-port=9222', '--headless=new']
  });

  let success = true;
  const results = {};

  try {
    // 1. Mobile Audit (Simulated 4G & Mid-tier mobile)
    console.log('\n📱 Mobil Cihaz Simülasyonu Denetimi:');
    const mobileReport = await lighthouse(url, {
      port: 9222,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: 'mobile',
      throttlingMethod: 'simulate'
    });

    const mCats = mobileReport.lhr.categories;
    const mAudits = mobileReport.lhr.audits;

    results.mobile = {
      performance: Math.round(mCats['performance'].score * 100),
      accessibility: Math.round(mCats['accessibility'].score * 100),
      bestPractices: Math.round(mCats['best-practices'].score * 100),
      seo: Math.round(mCats['seo'].score * 100),
      fcp: mAudits['first-contentful-paint'].displayValue,
      lcp: mAudits['largest-contentful-paint'].displayValue,
      tbt: mAudits['total-blocking-time'].displayValue,
      cls: mAudits['cumulative-layout-shift'].displayValue,
      speedIndex: mAudits['speed-index'].displayValue
    };

    console.log(`  ✔ Performance:    ${results.mobile.performance}/100`);
    console.log(`  ✔ Accessibility:  ${results.mobile.accessibility}/100`);
    console.log(`  ✔ Best Practices: ${results.mobile.bestPractices}/100`);
    console.log(`  ✔ SEO:            ${results.mobile.seo}/100`);
    console.log(`  • FCP (İlk Anlamlı Boyama): ${results.mobile.fcp}`);
    console.log(`  • LCP (En Büyük Boyama):    ${results.mobile.lcp}`);
    console.log(`  • TBT (Toplam Blok Süresi): ${results.mobile.tbt}`);
    console.log(`  • CLS (Kümülatif Düzen):    ${results.mobile.cls}`);
    console.log(`  • Hız İndeksi:              ${results.mobile.speedIndex}`);

    if (results.mobile.accessibility < 90 || results.mobile.seo < 90 || results.mobile.bestPractices < 90) {
      console.error('  ✖ Kritik skor hedefinin altında kalan kategori var!');
      success = false;
    }

  } catch (err) {
    console.error('Lighthouse denetiminde hata:', err);
    success = false;
  } finally {
    await browser.close();
  }

  return { success, results };
}

if (require.main === module) {
  runLighthouseAudit().then(({ success }) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runLighthouseAudit };
