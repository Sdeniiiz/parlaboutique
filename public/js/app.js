(function () {
  let catalog = { settings: {}, categories: [], products: [] };
  let activeCategory = 'all';
  let activeSize = '';
  let searchQuery = '';

  // Active variant state per product card so color selection persists on cards
  const cardVariantState = {};

  function formatPrice(num) {
    if (!num && num !== 0) return '';
    return Number(num).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' TL';
  }

  async function loadCatalog() {
    try {
      const res = await fetch('/api/catalog');
      catalog = await res.json();
      applySettings();
      renderDynamicCategoryNavs();
      renderFeaturedCategories();
      renderNewProducts();
      renderCollectionProducts();
    } catch (err) {
      console.error('Katalog yüklenemedi:', err);
    }
  }

  function applySettings() {
    const s = catalog.settings || {};
    if (s.announcement) {
      const el = document.getElementById('announcementText');
      if (el) el.textContent = s.announcement;
    }
    if (s.trendyolStoreUrl) {
      const fLink = document.getElementById('footerTrendyolLink');
      if (fLink) fLink.href = s.trendyolStoreUrl;
    }
  }

  // Dynamically populate Header Nav, Mobile Drawer, Collection Filter Tabs, and Footer from catalog.categories
  function renderDynamicCategoryNavs() {
    const cats = catalog.categories || [];

    // 1. Header Main Nav
    const mainNav = document.getElementById('mainNav');
    if (mainNav) {
      const allBtn = `<button type="button" class="nav-link ${activeCategory === 'all' ? 'active' : ''}" data-filter-cat="all">TÜM ÜRÜNLER</button>`;
      const catBtns = cats.map(c => {
        const cid = c.id || c.slug;
        const isActive = activeCategory === cid;
        return `<button type="button" class="nav-link ${isActive ? 'active' : ''}" data-filter-cat="${cid}">${c.name.toUpperCase()}</button>`;
      }).join('');
      mainNav.innerHTML = allBtn + catBtns;
    }

    // 2. Mobile Nav Drawer
    const mobileList = document.querySelector('#mobileDrawer .mobile-nav-list');
    if (mobileList) {
      const allBtn = `<button type="button" class="nav-link ${activeCategory === 'all' ? 'active' : ''}" data-filter-cat="all">TÜM ÜRÜNLER</button>`;
      const catBtns = cats.map(c => {
        const cid = c.id || c.slug;
        const isActive = activeCategory === cid;
        return `<button type="button" class="nav-link ${isActive ? 'active' : ''}" data-filter-cat="${cid}">${c.name.toUpperCase()}</button>`;
      }).join('');
      mobileList.innerHTML = allBtn + catBtns;
    }

    // 3. Collection Tabs
    const collectionTabs = document.getElementById('collectionTabs');
    if (collectionTabs) {
      const allBtn = `<button type="button" class="filter-tab ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">Tümü</button>`;
      const catTabs = cats.map(c => {
        const cid = c.id || c.slug;
        const isActive = activeCategory === cid;
        return `<button type="button" class="filter-tab ${isActive ? 'active' : ''}" data-cat="${cid}">${c.name}</button>`;
      }).join('');
      collectionTabs.innerHTML = allBtn + catTabs;
    }

    // 4. Footer Category Links
    const footerCats = document.getElementById('footerCategoryLinks');
    if (footerCats) {
      footerCats.innerHTML = cats.map(c => {
        const cid = c.id || c.slug;
        return `<a href="#koleksiyon" data-filter-cat="${cid}">${c.name}</a>`;
      }).join('');
    }

    // Rebind filter triggers
    bindCategoryFilterLinks();
  }

  function bindCategoryFilterLinks() {
    document.querySelectorAll('[data-filter-cat]').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        setCategoryFilter(el.getAttribute('data-filter-cat'), true);
      };
    });

    document.querySelectorAll('#collectionTabs .filter-tab').forEach(tab => {
      tab.onclick = () => {
        setCategoryFilter(tab.getAttribute('data-cat'), false);
      };
    });
  }

  function renderFeaturedCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    const featuredCats = (catalog.categories || []).filter(c => c.featured !== false).slice(0, 6);
    grid.innerHTML = featuredCats.map(cat => `
      <div class="category-card" data-cat-card="${cat.id || cat.slug}">
        <div class="category-img-wrap sheen-wrap">
          <img src="${cat.image || '/images/brand/parla-logo.jpg'}" alt="${cat.name}" loading="lazy" />
        </div>
        <div class="category-label">${cat.name}</div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-cat-card]').forEach(card => {
      card.addEventListener('click', () => {
        setCategoryFilter(card.getAttribute('data-cat-card'), true);
      });
    });
  }

  function createProductCardHTML(product, sectionPrefix) {
    const variants = product.variants && product.variants.length > 0
      ? product.variants
      : [{ id: 'default', colorName: 'Standart', colorHex: '#141210', images: [], sizes: [], trendyolUrl: product.trendyolUrl }];

    const stateKey = `${sectionPrefix}-${product.id}`;
    const activeVarIdx = cardVariantState[stateKey] || 0;
    const activeVariant = variants[activeVarIdx] || variants[0];

    const primaryImg = (activeVariant.images && activeVariant.images[0]) || '/images/brand/parla-logo.jpg';
    const hoverImg = (activeVariant.images && activeVariant.images[1]) || primaryImg;
    const targetTrendyolUrl = activeVariant.trendyolUrl || product.trendyolUrl || 'https://www.trendyol.com';

    const hasColors = product.hasColors !== false;
    const hasSizes = product.hasSizes !== false;

    let sizesHTML = '';
    if (hasSizes) {
      sizesHTML = (activeVariant.sizes || [])
        .map(s => `<span class="${s.inStock ? '' : 'out'}">${s.size}</span>`)
        .join(' · ');
    }

    let colorDotsHTML = '';
    if (hasColors && variants.length > 0) {
      colorDotsHTML = variants.map((v, idx) => `
        <button
          type="button"
          class="color-dot ${idx === activeVarIdx ? 'active' : ''}"
          style="background-color: ${v.colorHex || '#141210'};"
          title="${v.colorName || 'Renk'}"
          data-card-color-idx="${idx}"
          data-state-key="${stateKey}"
          data-product-id="${product.id}"
          aria-label="${v.colorName || 'Renk'}"
        ></button>
      `).join('');
    }

    const showMetaRow = Boolean(colorDotsHTML || sizesHTML);

    return `
      <article class="product-card" data-card-key="${stateKey}" data-product-id="${product.id}">
        <div class="product-media sheen-wrap" data-open-product="${product.id}" data-primary-img="${primaryImg}" data-hover-img="${hoverImg}">
          <img src="${primaryImg}" alt="${product.title}${hasColors && activeVariant.colorName ? ' - ' + activeVariant.colorName : ''}" loading="lazy" />
          ${product.isNew ? '<span class="product-subtle-tag">Yeni</span>' : ''}
        </div>

        <div class="product-info">
          ${showMetaRow ? `
            <div class="product-meta-row">
              <div class="color-dots">${colorDotsHTML}</div>
              <div class="product-sizes-text">${sizesHTML}</div>
            </div>
          ` : ''}

          <h3 class="product-title" data-open-product="${product.id}">${product.title}</h3>

          <div class="product-bottom-row">
            <div class="product-price-wrap">
              <span class="product-price">${formatPrice(product.price)}</span>
              ${product.oldPrice ? `<span class="product-old-price">${formatPrice(product.oldPrice)}</span>` : ''}
            </div>
            <a href="${targetTrendyolUrl}" target="_blank" rel="noopener noreferrer" class="product-trendyol-link">
              Trendyol'da Gör ↗
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function attachCardInteractions(container, sectionPrefix) {
    if (!container) return;

    // Hover image swap when a variant has 2+ photos
    container.querySelectorAll('.product-media').forEach(media => {
      const img = media.querySelector('img');
      const primary = media.getAttribute('data-primary-img');
      const hover = media.getAttribute('data-hover-img');
      if (primary && hover && primary !== hover) {
        media.addEventListener('mouseenter', () => { img.src = hover; });
        media.addEventListener('mouseleave', () => { img.src = primary; });
      }
    });

    // Open modal on image or title click
    container.querySelectorAll('[data-open-product]').forEach(el => {
      el.addEventListener('click', () => {
        const pid = el.getAttribute('data-open-product');
        const card = el.closest('.product-card');
        const stateKey = card ? card.getAttribute('data-card-key') : null;
        const initialVarIdx = stateKey && cardVariantState[stateKey] ? cardVariantState[stateKey] : 0;
        openProductModal(pid, initialVarIdx);
      });
    });

    // Interactive color dot click -> updates card image, sizes, and Trendyol link immediately
    container.querySelectorAll('[data-card-color-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-card-color-idx'));
        const stateKey = btn.getAttribute('data-state-key');
        const pid = btn.getAttribute('data-product-id');
        cardVariantState[stateKey] = idx;

        const product = (catalog.products || []).find(p => p.id === pid);
        const cardEl = btn.closest('.product-card');
        if (product && cardEl) {
          const temp = document.createElement('div');
          temp.innerHTML = createProductCardHTML(product, sectionPrefix).trim();
          const newCard = temp.firstElementChild;
          cardEl.replaceWith(newCard);
          attachCardInteractions(container, sectionPrefix);
        }
      });
    });
  }

  function renderNewProducts() {
    const grid = document.getElementById('newProductsGrid');
    if (!grid) return;
    const newItems = (catalog.products || []).filter(p => p.isNew).slice(0, 4);
    grid.innerHTML = newItems.map(p => createProductCardHTML(p, 'new')).join('');
    attachCardInteractions(grid, 'new');
  }

  function renderCollectionProducts() {
    const grid = document.getElementById('allProductsGrid');
    const countEl = document.getElementById('productCountText');
    if (!grid) return;

    let filtered = (catalog.products || []).slice();

    if (activeCategory && activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategory);
    }

    if (activeSize) {
      filtered = filtered.filter(p =>
        p.hasSizes !== false &&
        (p.variants || []).some(v =>
          (v.sizes || []).some(s => s.size.toLowerCase() === activeSize.toLowerCase() && s.inStock)
        )
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
        (p.variants || []).some(v => v.colorName && v.colorName.toLowerCase().includes(q))
      );
    }

    if (countEl) {
      countEl.textContent = `${filtered.length} ürün listeleniyor`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 16px; text-align: center; color: var(--parla-muted);">
          Aradığınız kriterlere uygun ürün bulunamadı.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => createProductCardHTML(p, 'all')).join('');
    attachCardInteractions(grid, 'all');
  }

  function setCategoryFilter(cat, scroll = false) {
    activeCategory = cat || 'all';

    // Update header nav links
    document.querySelectorAll('[data-filter-cat]').forEach(el => {
      if (el.classList.contains('nav-link')) {
        el.classList.toggle('active', el.getAttribute('data-filter-cat') === activeCategory);
      }
    });

    // Update collection tabs
    document.querySelectorAll('#collectionTabs .filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-cat') === activeCategory);
    });

    renderCollectionProducts();

    const drawer = document.getElementById('mobileDrawer');
    if (drawer) drawer.classList.remove('open');

    if (scroll) {
      const sec = document.getElementById('koleksiyon');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Product Detail Modal Logic
  function openProductModal(productIdOrSlug, initialVariantIdx = 0) {
    const product = (catalog.products || []).find(
      p => p.id === productIdOrSlug || p.slug === productIdOrSlug
    );
    if (!product) return;

    const backdrop = document.getElementById('productModalBackdrop');
    const modalBody = document.getElementById('modalBody');
    if (!backdrop || !modalBody) return;

    const hasColors = product.hasColors !== false;
    const hasSizes = product.hasSizes !== false;
    const hasFabricInfo = product.hasFabricInfo !== false && Boolean(product.fabricInfo);
    const hasDescription = product.hasDescription !== false && Boolean(product.description);

    const variants = product.variants && product.variants.length > 0
      ? product.variants
      : [{ id: 'default', colorName: '', colorHex: '#141210', images: [], sizes: [], trendyolUrl: product.trendyolUrl }];

    let selectedVarIdx = initialVariantIdx < variants.length ? initialVariantIdx : 0;
    let selectedImgIdx = 0;
    let selectedSize = '';

    function syncDefaultSize() {
      if (!hasSizes) {
        selectedSize = '';
        return;
      }
      const v = variants[selectedVarIdx];
      const firstAvail = (v.sizes || []).find(s => s.inStock);
      selectedSize = firstAvail ? firstAvail.size : ((v.sizes && v.sizes[0] && v.sizes[0].size) || 'Standart');
    }
    syncDefaultSize();

    function renderModalInner() {
      const v = variants[selectedVarIdx];
      const images = v.images && v.images.length > 0 ? v.images : ['/images/brand/parla-logo.jpg'];
      const currentImg = images[selectedImgIdx] || images[0];
      const trendyolTarget = v.trendyolUrl || product.trendyolUrl || 'https://www.trendyol.com';

      // Build personalized WhatsApp message
      const detailsList = [];
      if (hasColors && v.colorName) detailsList.push(`Renk: ${v.colorName}`);
      if (hasSizes && selectedSize) detailsList.push(`Beden: ${selectedSize}`);
      const detailsStr = detailsList.length > 0 ? ` (${detailsList.join(', ')})` : '';
      const whatsappText = encodeURIComponent(
        `Merhaba parlaboutiqesamsun, "${product.title}"${detailsStr} ürünü hakkında bilgi almak istiyorum.`
      );

      modalBody.innerHTML = `
        <div class="modal-gallery">
          <div class="modal-main-img">
            <img src="${currentImg}" alt="${product.title}${hasColors && v.colorName ? ' - ' + v.colorName : ''}" />
          </div>
          ${images.length > 1 ? `
            <div class="modal-thumbs">
              ${images.map((imgUrl, idx) => `
                <div class="modal-thumb ${idx === selectedImgIdx ? 'active' : ''}" data-thumb-idx="${idx}">
                  <img src="${imgUrl}" alt="Görsel ${idx + 1}" />
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="modal-details">
          <div>
            <div class="modal-code">${product.categoryName || 'Koleksiyon'} · ${product.code || ''}</div>
            <h2 class="modal-title">${product.title}</h2>
          </div>

          <div class="modal-price-row">
            <span class="modal-price">${formatPrice(product.price)}</span>
            ${product.oldPrice ? `<span class="modal-old-price">${formatPrice(product.oldPrice)}</span>` : ''}
          </div>

          <!-- Color Variant Selector (Only if hasColors is TRUE) -->
          ${hasColors && variants.length > 1 ? `
            <div class="variant-group">
              <div class="variant-label">Renk Seçenekleri: <strong>${v.colorName || 'Standart'}</strong></div>
              <div class="modal-color-list">
                ${variants.map((varItem, idx) => `
                  <button type="button" class="modal-color-option ${idx === selectedVarIdx ? 'active' : ''}" data-modal-var="${idx}">
                    <span class="color-dot ${idx === selectedVarIdx ? 'active' : ''}" style="background-color: ${varItem.colorHex || '#141210'};"></span>
                    <span>${varItem.colorName || 'Renk ' + (idx + 1)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Size Selector (Only if hasSizes is TRUE) -->
          ${hasSizes && (v.sizes || []).length > 0 ? `
            <div class="variant-group">
              <div class="variant-label">Beden Seçimi: <strong>${selectedSize || 'Lütfen Seçiniz'}</strong></div>
              <div class="modal-size-list">
                ${(v.sizes || []).map(sz => `
                  <button
                    type="button"
                    class="modal-size-item ${sz.size === selectedSize ? 'active' : ''}"
                    data-modal-size="${sz.size}"
                    ${sz.inStock ? '' : 'disabled title="Stokta Yok"'}
                  >
                    ${sz.size}${sz.inStock ? '' : ' (Tükendi)'}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Description (Only if hasDescription is TRUE) -->
          ${hasDescription ? `<p class="modal-desc">${product.description}</p>` : ''}

          <!-- Fabric Info (Only if hasFabricInfo is TRUE) -->
          ${hasFabricInfo ? `<div class="modal-fabric"><strong>Kumaş &amp; Kalıp:</strong> ${product.fabricInfo}</div>` : ''}

          <!-- Single Intentional Conversion Action: Trendyol Redirect -->
          <a href="${trendyolTarget}" target="_blank" rel="noopener noreferrer" class="trendyol-primary-cta">
            <span>Trendyol'da İncele ve Sipariş Ver</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </a>

          <div class="modal-secondary-links">
            <a href="https://wa.me/905320613784?text=${whatsappText}" target="_blank" rel="noopener noreferrer">
              WhatsApp ile Mağazaya Sor
            </a>
            ${product.instagramPostUrl ? `
              <a href="${product.instagramPostUrl}" target="_blank" rel="noopener noreferrer">
                Instagram Gönderisini Gör ↗
              </a>
            ` : ''}
          </div>
        </div>
      `;

      // Bind thumbnail clicks
      modalBody.querySelectorAll('[data-thumb-idx]').forEach(t => {
        t.addEventListener('click', () => {
          selectedImgIdx = Number(t.getAttribute('data-thumb-idx'));
          renderModalInner();
        });
      });

      // Bind color variant clicks
      modalBody.querySelectorAll('[data-modal-var]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedVarIdx = Number(btn.getAttribute('data-modal-var'));
          selectedImgIdx = 0;
          syncDefaultSize();
          renderModalInner();
        });
      });

      // Bind size clicks
      modalBody.querySelectorAll('[data-modal-size]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSize = btn.getAttribute('data-modal-size');
          renderModalInner();
        });
      });
    }

    renderModalInner();
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    const backdrop = document.getElementById('productModalBackdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    loadCatalog();

    // Size filters
    document.querySelectorAll('#sizeFilters .size-filter-link').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSize = btn.getAttribute('data-size') || '';
        document.querySelectorAll('#sizeFilters .size-filter-link').forEach(b => {
          b.classList.toggle('active', (b.getAttribute('data-size') || '') === activeSize);
        });
        renderCollectionProducts();
      });
    });

    // Hero cards open modal
    document.querySelectorAll('[data-open-slug]').forEach(card => {
      card.addEventListener('click', () => {
        openProductModal(card.getAttribute('data-open-slug'), 0);
      });
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderCollectionProducts();
      });
    }

    // Mobile drawer toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileDrawer = document.getElementById('mobileDrawer');
    if (mobileBtn && mobileDrawer) {
      mobileBtn.addEventListener('click', () => {
        mobileDrawer.classList.toggle('open');
      });
    }

    // Modal close events
    const closeBtn = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('productModalBackdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeProductModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeProductModal();
    });
  });
})();
