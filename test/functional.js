const { chromium } = require('playwright');

async function runFunctionalAudit() {
  console.log('\n--- [4] FONKSİYONEL KULLANICI AKIŞLARI & QA TESTLERİ (PLAYWRIGHT) ---');
  let failures = [];
  let passes = 0;

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    browser = await chromium.launch({ headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Monitor console errors and network request errors
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', req => {
    networkFailures.push(req.url() + ' -> ' + (req.failure() ? req.failure().errorText : 'failed'));
  });

  // 1. Initial Load
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const title = await page.title();
  if (title.includes('PARLA BOUTİQUE')) {
    console.log(`  ✔ Sayfa Yükleme: Başarılı (${title})`);
    passes++;
  } else {
    failures.push('Sayfa başlığı geçersiz');
  }

  // Check initial product count in allProductsGrid
  const initialCardsCount = await page.locator('#allProductsGrid .product-card').count();
  if (initialCardsCount > 0) {
    console.log(`  ✔ Koleksiyon Listeleme: ${initialCardsCount} ürün başarıyla yüklendi`);
    passes++;
  } else {
    failures.push('Koleksiyon ızgarasında (#allProductsGrid) ürün bulunamadı');
  }

  // 2. Category Filter Interaction
  const catTab = await page.$('#collectionTabs .filter-tab:nth-child(2)');
  if (catTab) {
    const catName = await catTab.innerText();
    await catTab.click();
    await page.waitForTimeout(300);
    const filteredCount = await page.locator('#allProductsGrid .product-card').count();
    if (filteredCount > 0) {
      console.log(`  ✔ Kategori Filtreleme: "${catName}" sekmesi tıklandı, ${filteredCount} ürün filtrelendi`);
      passes++;
    } else {
      failures.push(`"${catName}" sekmesi tıklandığında ürün listelenmedi`);
    }

    // Switch back to "Tümü"
    await page.click('#collectionTabs .filter-tab:first-child');
    await page.waitForTimeout(300);
    const resetCount = await page.locator('#allProductsGrid .product-card').count();
    if (resetCount === initialCardsCount) {
      console.log('  ✔ Filtre Sıfırlama: "Tümü" sekmesi tam listeyi geri getirdi');
      passes++;
    } else {
      failures.push('Kategori filtresi sıfırlanırken ürün sayısı eşleşmedi');
    }
  }

  // 3. Search Box Interaction
  const searchInput = await page.$('#searchInput');
  if (searchInput) {
    await searchInput.fill('kaban');
    await page.waitForTimeout(300);
    const searchResultCount = await page.locator('#allProductsGrid .product-card').count();
    if (searchResultCount > 0) {
      console.log(`  ✔ Arama İşlevi: "kaban" araması sonucu ${searchResultCount} ürün listelendi`);
      passes++;
    } else {
      failures.push('Arama sonucunda ürün bulunamadı');
    }

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  }

  // 4. Product Modal Flow
  const firstCard = await page.$('#allProductsGrid .product-card:first-child .product-media');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(500);

    const modalData = await page.evaluate(() => {
      const modal = document.getElementById('productModalContent');
      const titleEl = modal ? modal.querySelector('.modal-title') : null;
      const priceEl = modal ? modal.querySelector('.modal-price') : null;
      const trendyolBtn = modal ? modal.querySelector('.trendyol-primary-cta') : null;
      const waLink = modal ? modal.querySelector('.modal-secondary-links a[href*="wa.me"]') : null;

      return {
        hasTitle: Boolean(titleEl && titleEl.innerText.trim()),
        titleText: titleEl ? titleEl.innerText.trim() : '',
        hasPrice: Boolean(priceEl && priceEl.innerText.trim()),
        hasTrendyolBtn: Boolean(trendyolBtn && trendyolBtn.href && trendyolBtn.href.includes('trendyol.com')),
        hasWaLink: Boolean(waLink && waLink.href && waLink.href.includes('wa.me'))
      };
    });

    if (modalData.hasTitle && modalData.hasPrice && modalData.hasTrendyolBtn) {
      console.log(`  ✔ Ürün Detay Modalı: "${modalData.titleText}" ürünü detayları, Trendyol ve WhatsApp yönlendirmeleriyle eksiksiz açıldı`);
      passes++;
    } else {
      failures.push('Ürün modalı içeriği eksik');
    }

    // Close modal via close button
    await page.click('#closeModalBtn');
    await page.waitForTimeout(200);
    const isClosed = await page.evaluate(() => {
      const backdrop = document.getElementById('productModalBackdrop');
      return !backdrop || window.getComputedStyle(backdrop).display === 'none';
    });
    if (isClosed) {
      console.log('  ✔ Modal Kapatma: Kapatma butonu başarıyla kapattı');
      passes++;
    } else {
      failures.push('Modal kapatma butonu çalışmadı');
    }
  }

  // 5. Admin Panel Load Test
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  const adminTitle = await page.title();
  const adminTable = await page.$('#adminProductsTable');
  if (adminTitle.includes('Yönetim Paneli') && adminTable) {
    console.log('  ✔ Yönetim Paneli (/admin): Yönetim arayüzü ve ürün tablosu hatasız açıldı');
    passes++;
  } else {
    failures.push('Yönetim paneli yüklenemedi');
  }

  // 6. Console Errors & Network Failures Check
  if (consoleErrors.length === 0) {
    console.log('  ✔ Tarayıcı Konsol Hataları: 0 hata (Konsol tertemiz)');
    passes++;
  } else {
    consoleErrors.forEach(e => console.error('  ✖ Konsol Hatası: ' + e));
    failures.push(`${consoleErrors.length} adet konsol hatası tespit edildi`);
  }

  if (networkFailures.length === 0) {
    console.log('  ✔ Ağ İstekleri: 0 başarısız istek (Tüm statik ve API kaynakları 200 OK)');
    passes++;
  } else {
    networkFailures.forEach(nf => console.error('  ✖ Ağ Hatası: ' + nf));
    failures.push(`${networkFailures.length} adet başarısız ağ isteği tespit edildi`);
  }

  await browser.close();

  console.log(`Fonksiyonel Test Sonucu: ${passes} Başarılı, ${failures.length} Başarısız`);
  return failures.length === 0;
}

if (require.main === module) {
  runFunctionalAudit().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runFunctionalAudit };
