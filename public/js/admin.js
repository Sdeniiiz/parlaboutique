(function () {
  let catalog = { settings: {}, categories: [], products: [], photoEvaluation: [] };
  let mediaLibrary = [];
  let editingVariants = [];
  let editingFeatures = {
    hasColors: true,
    hasSizes: true,
    hasFabricInfo: true,
    hasDescription: true
  };

  const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '36', '38', '40', '42', 'Standart'];

  function showToast(msg) {
    const t = document.getElementById('adminToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  function formatPrice(num) {
    return Number(num || 0).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' TL';
  }

  async function loadAdminData() {
    try {
      const [catRes, mediaRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch('/api/media')
      ]);
      catalog = await catRes.json();
      const mediaData = await mediaRes.json();
      mediaLibrary = mediaData.images || [];

      renderStats();
      renderProductsTable();
      renderCategoriesTable();
      populateCategorySelects();
      renderEvaluationReport();
    } catch (err) {
      console.error('Veri yüklenemedi:', err);
      showToast('Veriler yüklenirken hata oluştu.');
    }
  }

  function renderStats() {
    const products = catalog.products || [];
    let totalVariants = 0;
    let totalImages = 0;
    let trendyolLinked = 0;

    products.forEach(p => {
      if (p.trendyolUrl && p.trendyolUrl.includes('trendyol.com')) {
        trendyolLinked++;
      }
      (p.variants || []).forEach(v => {
        totalVariants++;
        totalImages += (v.images || []).length;
      });
    });

    document.getElementById('statTotalProducts').textContent = products.length;
    document.getElementById('statTotalVariants').textContent = totalVariants;
    document.getElementById('statTotalImages').textContent = totalImages;
    document.getElementById('statTrendyolLinked').textContent = `${trendyolLinked} / ${products.length}`;
  }

  function populateCategorySelects() {
    const sel = document.getElementById('editCategory');
    if (!sel) return;
    const cats = catalog.categories || [];
    const currentVal = sel.value;
    sel.innerHTML = cats.map(c => `
      <option value="${c.id || c.slug}">${c.name}</option>
    `).join('');
    if (currentVal && cats.some(c => (c.id || c.slug) === currentVal)) {
      sel.value = currentVal;
    }
  }

  function renderProductsTable() {
    const tbody = document.getElementById('adminProductsTable');
    if (!tbody) return;
    const products = catalog.products || [];

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 32px;">Henüz ürün bulunmuyor.</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const firstVar = (p.variants && p.variants[0]) || { images: [] };
      const thumb = (firstVar.images && firstVar.images[0]) || '/images/brand/parla-logo.jpg';

      const hasColors = p.hasColors !== false;
      const hasSizes = p.hasSizes !== false;

      let featureSummaryHTML = '';
      if (!hasColors) {
        featureSummaryHTML += `<div style="margin-bottom:4px;"><span class="cat-badge" style="background:#e0e7ff; color:#3730a3;">Tek Renk</span></div>`;
      }
      if (!hasSizes) {
        featureSummaryHTML += `<div style="margin-bottom:4px;"><span class="cat-badge" style="background:#fef3c7; color:#92400e;">Beden Yok / Standart</span></div>`;
      }

      const variantsSummary = (p.variants || []).map((v, idx) => {
        const sizesStr = hasSizes
          ? (v.sizes || []).map(s => s.inStock ? s.size : `${s.size}(Yok)`).join(', ')
          : 'Standart / Bedensiz';

        const colorPart = hasColors
          ? `<span class="color-dot" style="background-color:${v.colorHex || '#141210'}; width:11px; height:11px; flex-shrink:0;"></span>
             <strong>${v.colorName || 'Renk'}:</strong>`
          : `<strong>Fotoğraf Galerisi:</strong>`;

        return `
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-bottom:5px; font-size:12px;">
            ${colorPart}
            <span style="color:var(--parla-muted);">${sizesStr}</span>
            <span style="color:var(--parla-gold-dark); font-size:11px;">(${(v.images || []).length} görsel)</span>
          </div>
        `;
      }).join('');

      return `
        <tr>
          <td>
            <img src="${thumb}" alt="${p.title}" class="table-thumb" />
          </td>
          <td>
            <div style="font-weight: 600; color: var(--parla-black); margin-bottom: 3px;">${p.title}</div>
            <div style="font-size: 11.5px; color: var(--parla-muted);">${p.categoryName || p.category} · Kod: ${p.code || '-'}</div>
          </td>
          <td>
            ${featureSummaryHTML}
            ${variantsSummary}
          </td>
          <td>
            <div style="font-weight: 600;">${formatPrice(p.price)}</div>
            ${p.oldPrice ? `<div style="font-size:11px; color:var(--parla-muted); text-decoration:line-through;">${formatPrice(p.oldPrice)}</div>` : ''}
          </td>
          <td>
            <div class="inline-trendyol-group">
              <input
                type="url"
                class="form-input"
                style="padding: 6px 8px; font-size: 12px;"
                value="${p.trendyolUrl || ''}"
                data-quick-link-input="${p.id}"
                placeholder="https://www.trendyol.com/..."
              />
              <button type="button" class="btn-text" data-quick-link-save="${p.id}">Kaydet</button>
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <button type="button" class="btn-text" data-edit-product="${p.id}">Düzenle / Görseller</button>
              <button type="button" class="btn-text danger" data-delete-product="${p.id}">Sil</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Quick Trendyol URL save
    tbody.querySelectorAll('[data-quick-link-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-quick-link-save');
        const input = tbody.querySelector(`[data-quick-link-input="${pid}"]`);
        if (!input) return;
        const newUrl = input.value.trim();
        try {
          const res = await fetch(`/api/products/${pid}/trendyol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trendyolUrl: newUrl })
          });
          if (res.ok) {
            showToast('Trendyol bağlantısı güncellendi.');
            loadAdminData();
          }
        } catch (err) {
          showToast('Bağlantı güncellenemedi.');
        }
      });
    });

    // Edit product button
    tbody.querySelectorAll('[data-edit-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-edit-product');
        const prod = (catalog.products || []).find(p => p.id === pid);
        if (prod) openEditorModal(prod);
      });
    });

    // Delete product button
    tbody.querySelectorAll('[data-delete-product]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-delete-product');
        const prod = (catalog.products || []).find(p => p.id === pid);
        if (!prod) return;
        if (!confirm(`"${prod.title}" ürününü silmek istediğinize emin misiniz?`)) return;
        try {
          const res = await fetch(`/api/products/${pid}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Ürün silindi.');
            loadAdminData();
          }
        } catch (err) {
          showToast('Ürün silinirken hata oluştu.');
        }
      });
    });
  }

  // CATEGORY MANAGEMENT TABLE & ACTIONS
  function renderCategoriesTable() {
    const tbody = document.getElementById('adminCategoriesTable');
    if (!tbody) return;
    const cats = catalog.categories || [];
    const products = catalog.products || [];

    if (cats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 28px;">Henüz kategori eklenmedi.</td></tr>`;
      return;
    }

    tbody.innerHTML = cats.map(cat => {
      const pCount = products.filter(p => p.category === cat.id || p.category === cat.slug).length;
      const flags = [
        cat.defaultHasColors !== false ? 'Renk' : null,
        cat.defaultHasSizes !== false ? 'Beden' : 'Bedensiz',
        cat.defaultHasFabricInfo !== false ? 'Kumaş' : null,
        cat.defaultHasDescription !== false ? 'Açıklama' : null
      ].filter(Boolean).map(f => `<span class="cat-badge">${f}</span>`).join(' ');

      return `
        <tr>
          <td>
            <img src="${cat.image || '/images/brand/parla-logo.jpg'}" alt="${cat.name}" style="width:42px; height:42px; object-fit:cover; border-radius:4px; border:1px solid var(--parla-border);" />
          </td>
          <td>
            <strong>${cat.name}</strong>
          </td>
          <td><code>${cat.slug || cat.id}</code></td>
          <td>${flags || '<span style="color:var(--parla-muted);">-</span>'}</td>
          <td>
            <span style="color:${cat.featured !== false ? 'var(--parla-gold-dark)' : 'var(--parla-muted)'}; font-weight:600;">
              ${cat.featured !== false ? '★ Vitrinde Aktif' : 'Gizli'}
            </span>
          </td>
          <td><strong>${pCount}</strong> ürün</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="btn-text" data-edit-cat="${cat.id || cat.slug}">Düzenle</button>
              <button type="button" class="btn-text danger" data-delete-cat="${cat.id || cat.slug}">Sil</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-edit-cat');
        const cat = (catalog.categories || []).find(c => (c.id || c.slug) === cid);
        if (cat) openCategoryModal(cat);
      });
    });

    tbody.querySelectorAll('[data-delete-cat]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cid = btn.getAttribute('data-delete-cat');
        const cat = (catalog.categories || []).find(c => (c.id || c.slug) === cid);
        if (!cat) return;
        if (!confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz?`)) return;
        try {
          const res = await fetch(`/api/categories/${cid}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Kategori silindi.');
            loadAdminData();
          } else {
            showToast('Kategori silinemedi.');
          }
        } catch (err) {
          showToast('Kategori silinirken hata oluştu.');
        }
      });
    });
  }

  function openCategoryModal(cat = null) {
    const backdrop = document.getElementById('categoryModalBackdrop');
    const title = document.getElementById('categoryModalTitle');
    if (cat) {
      title.textContent = `Kategoriyi Düzenle: ${cat.name}`;
      document.getElementById('editCategoryId').value = cat.id || cat.slug;
      document.getElementById('editCategoryName').value = cat.name || '';
      document.getElementById('editCategoryImage').value = cat.image || '';
      document.getElementById('catDefColors').checked = cat.defaultHasColors !== false;
      document.getElementById('catDefSizes').checked = cat.defaultHasSizes !== false;
      document.getElementById('catDefFabric').checked = cat.defaultHasFabricInfo !== false;
      document.getElementById('catDefDesc').checked = cat.defaultHasDescription !== false;
      document.getElementById('catFeatured').checked = cat.featured !== false;
    } else {
      title.textContent = 'Yeni Kategori Ekle';
      document.getElementById('editCategoryId').value = '';
      document.getElementById('editCategoryName').value = '';
      document.getElementById('editCategoryImage').value = '/images/brand/parla-logo.jpg';
      document.getElementById('catDefColors').checked = true;
      document.getElementById('catDefSizes').checked = true;
      document.getElementById('catDefFabric').checked = true;
      document.getElementById('catDefDesc').checked = true;
      document.getElementById('catFeatured').checked = true;
    }
    backdrop.classList.add('open');
  }

  function closeCategoryModal() {
    document.getElementById('categoryModalBackdrop').classList.remove('open');
  }

  function renderEvaluationReport() {
    const grid = document.getElementById('evalReportGrid');
    if (!grid) return;
    const list = catalog.photoEvaluation || [];
    grid.innerHTML = list.map(item => {
      const badgeColor = item.status === 'excluded' ? '#991b1b' : '#166534';
      const badgeText = item.status === 'excluded'
        ? 'Elendi (Kullanılmadı)'
        : item.status === 'selected_edited'
          ? 'Seçildi & Kadraj/Metin Temizlendi'
          : 'Seçildi & Doğrudan Kullanıldı';
      return `
        <div class="eval-card">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <span style="font-size:11px; font-weight:600; color:${badgeColor}; text-transform:uppercase; letter-spacing:0.06em;">
              ● ${badgeText}
            </span>
            <span style="font-size:12px; font-weight:600; color:var(--parla-gold-dark);">Puan: ${item.rating}</span>
          </div>
          <h4 style="font-size:15px; font-weight:600; margin-bottom:6px;">${item.title}</h4>
          <div style="font-size:11px; color:var(--parla-muted); margin-bottom:8px;">Instagram Kodu: ${item.postCode}</div>
          <p style="font-size:13px; color:var(--parla-text); line-height:1.6;">${item.notes}</p>
        </div>
      `;
    }).join('');
  }

  // Feature Toggle UI Synchronization
  function syncFeatureToggleUI() {
    const btnColors = document.getElementById('btnToggleColors');
    const btnSizes = document.getElementById('btnToggleSizes');
    const btnFabric = document.getElementById('btnToggleFabric');
    const btnDesc = document.getElementById('btnToggleDesc');

    const chkColors = document.getElementById('toggleHasColors');
    const chkSizes = document.getElementById('toggleHasSizes');
    const chkFabric = document.getElementById('toggleHasFabric');
    const chkDesc = document.getElementById('toggleHasDesc');

    chkColors.checked = editingFeatures.hasColors;
    chkSizes.checked = editingFeatures.hasSizes;
    chkFabric.checked = editingFeatures.hasFabricInfo;
    chkDesc.checked = editingFeatures.hasDescription;

    btnColors.classList.toggle('active', editingFeatures.hasColors);
    btnSizes.classList.toggle('active', editingFeatures.hasSizes);
    btnFabric.classList.toggle('active', editingFeatures.hasFabricInfo);
    btnDesc.classList.toggle('active', editingFeatures.hasDescription);

    // Show/hide optional form fields
    const wrapFabric = document.getElementById('wrapFabric');
    const wrapDesc = document.getElementById('wrapDescription');
    if (wrapFabric) wrapFabric.style.display = editingFeatures.hasFabricInfo ? 'block' : 'none';
    if (wrapDesc) wrapDesc.style.display = editingFeatures.hasDescription ? 'block' : 'none';

    // Show/hide Add Color Variant button
    const addVarBtn = document.getElementById('addVariantBtn');
    const varSecTitle = document.getElementById('variantsSectionTitle');
    const varSecSub = document.getElementById('variantsSectionSub');

    if (addVarBtn) {
      addVarBtn.style.display = editingFeatures.hasColors ? 'inline-block' : 'none';
    }
    if (varSecTitle) {
      varSecTitle.textContent = editingFeatures.hasColors
        ? (editingFeatures.hasSizes ? 'Renk, Beden & Görsel Varyantları' : 'Renk & Görsel Varyantları (Bedensiz)')
        : (editingFeatures.hasSizes ? 'Görseller & Beden Seçenekleri' : 'Ürün Görselleri (Tek Model / Bedensiz)');
    }
    if (varSecSub) {
      varSecSub.textContent = editingFeatures.hasColors
        ? 'Ürünün farklı renklerini, her rengin fotoğraflarını ve stok durumunu düzenleyin.'
        : 'Ürünün fotoğraflarını bilgisayardan veya Instagram kütüphanesinden ekleyin.';
    }

    // If colors are toggled off and more than 1 variant existed, collapse images into the first variant
    if (!editingFeatures.hasColors && editingVariants.length > 1) {
      const allImgs = [];
      editingVariants.forEach(v => (v.images || []).forEach(img => { if (!allImgs.includes(img)) allImgs.push(img); }));
      editingVariants = [{
        id: editingVariants[0].id || ('var-' + Date.now()),
        colorName: '',
        colorHex: '#141210',
        trendyolUrl: editingVariants[0].trendyolUrl || '',
        images: allImgs,
        sizes: editingVariants[0].sizes || []
      }];
    }

    renderVariantsEditor();
  }

  // Editor Modal Logic
  function openEditorModal(product = null) {
    const backdrop = document.getElementById('editorModalBackdrop');
    const titleEl = document.getElementById('editorModalTitle');
    populateCategorySelects();

    if (product) {
      titleEl.textContent = `Ürünü Düzenle: ${product.title}`;
      document.getElementById('editProductId').value = product.id;
      document.getElementById('editTitle').value = product.title || '';
      document.getElementById('editCategory').value = product.category || 'bluz';
      document.getElementById('editCode').value = product.code || '';
      document.getElementById('editPrice').value = product.price || '';
      document.getElementById('editOldPrice').value = product.oldPrice || '';
      document.getElementById('editTrendyolUrl').value = product.trendyolUrl || '';
      document.getElementById('editFabric').value = product.fabricInfo || '';
      document.getElementById('editIsNew').checked = product.isNew !== false;
      document.getElementById('editFeatured').checked = product.featured !== false;
      document.getElementById('editDescription').value = product.description || '';

      editingFeatures = {
        hasColors: product.hasColors !== undefined ? Boolean(product.hasColors) : true,
        hasSizes: product.hasSizes !== undefined ? Boolean(product.hasSizes) : (product.category !== 'aksesuar'),
        hasFabricInfo: product.hasFabricInfo !== undefined ? Boolean(product.hasFabricInfo) : Boolean(product.fabricInfo),
        hasDescription: product.hasDescription !== undefined ? Boolean(product.hasDescription) : Boolean(product.description)
      };

      editingVariants = JSON.parse(JSON.stringify(product.variants || []));
      if (editingVariants.length === 0) {
        editingVariants = [{
          id: 'var-' + Date.now(),
          colorName: editingFeatures.hasColors ? 'Standart' : '',
          colorHex: '#141210',
          trendyolUrl: product.trendyolUrl || '',
          images: [],
          sizes: editingFeatures.hasSizes ? [{ size: 'S', inStock: true }] : []
        }];
      }
    } else {
      titleEl.textContent = 'Yeni Ürün Ekle';
      document.getElementById('editProductId').value = '';
      document.getElementById('editTitle').value = '';
      const defaultCat = (catalog.categories && catalog.categories[0] && (catalog.categories[0].id || catalog.categories[0].slug)) || 'bluz';
      document.getElementById('editCategory').value = defaultCat;
      document.getElementById('editCode').value = `PB-2026-0${(catalog.products || []).length + 1}`;
      document.getElementById('editPrice').value = '';
      document.getElementById('editOldPrice').value = '';
      document.getElementById('editTrendyolUrl').value = 'https://www.trendyol.com/';
      document.getElementById('editFabric').value = '';
      document.getElementById('editIsNew').checked = true;
      document.getElementById('editFeatured').checked = true;
      document.getElementById('editDescription').value = '';

      const catObj = (catalog.categories || []).find(c => (c.id || c.slug) === defaultCat);
      editingFeatures = {
        hasColors: catObj ? (catObj.defaultHasColors !== false) : true,
        hasSizes: catObj ? (catObj.defaultHasSizes !== false) : true,
        hasFabricInfo: catObj ? (catObj.defaultHasFabricInfo !== false) : true,
        hasDescription: catObj ? (catObj.defaultHasDescription !== false) : true
      };

      editingVariants = [
        {
          id: 'var-' + Date.now(),
          colorName: editingFeatures.hasColors ? 'Siyah' : '',
          colorHex: '#141210',
          trendyolUrl: '',
          images: [],
          sizes: editingFeatures.hasSizes ? [
            { size: 'S', inStock: true },
            { size: 'M', inStock: true },
            { size: 'L', inStock: true }
          ] : []
        }
      ];
    }

    syncFeatureToggleUI();
    backdrop.classList.add('open');
  }

  function closeEditorModal() {
    document.getElementById('editorModalBackdrop').classList.remove('open');
  }

  function renderVariantsEditor() {
    const container = document.getElementById('variantsContainer');
    if (!container) return;

    const mediaOptions = mediaLibrary.map(url => {
      const label = url.split('/').pop();
      return `<option value="${url}">${label}</option>`;
    }).join('');

    const hasColors = editingFeatures.hasColors;
    const hasSizes = editingFeatures.hasSizes;

    container.innerHTML = editingVariants.map((v, vIdx) => {
      const imagesHTML = (v.images || []).map((imgUrl, imgIdx) => `
        <div class="variant-img-item">
          <img src="${imgUrl}" alt="Görsel ${imgIdx + 1}" />
          <div class="variant-img-actions">
            ${imgIdx === 0
              ? '<span style="color:var(--parla-gold-dark); font-weight:600;">★ Kapak</span>'
              : `<button type="button" class="btn-text" style="font-size:10px; padding:0;" data-make-cover="${vIdx}:${imgIdx}">Kapak Yap</button>`
            }
            <button type="button" class="btn-text danger" style="font-size:10px; padding:0;" data-remove-img="${vIdx}:${imgIdx}">Sil</button>
          </div>
        </div>
      `).join('');

      const sizesHTML = (v.sizes || []).map((s, sIdx) => `
        <div class="size-chip">
          <strong>${s.size}</strong>
          <label style="display:inline-flex; align-items:center; gap:3px; cursor:pointer; font-size:11px; color:var(--parla-muted);">
            <input type="checkbox" ${s.inStock ? 'checked' : ''} data-toggle-stock="${vIdx}:${sIdx}" />
            Stokta
          </label>
          <button type="button" class="btn-text danger" style="font-size:11px; padding:0 2px; text-decoration:none;" data-remove-size="${vIdx}:${sIdx}" title="Bedeni Kaldır">&times;</button>
        </div>
      `).join('');

      return `
        <div class="variant-editor-box" data-variant-box="${vIdx}">
          <div class="variant-editor-header">
            <div style="display:flex; align-items:center; gap:10px;">
              ${hasColors ? `<span class="color-dot" style="background-color:${v.colorHex || '#141210'};"></span>` : ''}
              <strong style="font-size:14px;">
                ${hasColors ? `Renk Varyantı #${vIdx + 1}: ${v.colorName || 'Renk'}` : 'Ürün Görselleri & Medya Galerisi'}
              </strong>
            </div>
            ${hasColors && editingVariants.length > 1 ? `
              <button type="button" class="btn-text danger" data-remove-variant="${vIdx}">Bu Rengi Sil</button>
            ` : ''}
          </div>

          <div class="form-grid">
            ${hasColors ? `
              <div class="col-4">
                <label class="field-label">Renk Adı *</label>
                <input type="text" class="form-input" value="${v.colorName || ''}" data-var-field="${vIdx}:colorName" placeholder="Örn: Siyah, Ekru, Lacivert" />
              </div>

              <div class="col-4">
                <label class="field-label">Renk Kodu (Swatches)</label>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="color" value="${v.colorHex || '#141210'}" data-var-field="${vIdx}:colorHex" style="width:42px; height:36px; border:1px solid var(--parla-border); background:none; cursor:pointer;" />
                  <input type="text" class="form-input" value="${v.colorHex || '#141210'}" data-var-field="${vIdx}:colorHexText" />
                </div>
              </div>

              <div class="col-4">
                <label class="field-label">Bu Renge Özel Trendyol Linki (Opsiyonel)</label>
                <input type="url" class="form-input" value="${v.trendyolUrl || ''}" data-var-field="${vIdx}:trendyolUrl" placeholder="Boş bırakılırsa ana link kullanılır" />
              </div>
            ` : ''}

            <!-- SIZES MANAGEMENT (ONLY IF hasSizes IS ACTIVE) -->
            ${hasSizes ? `
              <div class="col-12" style="background:var(--parla-white); padding:12px; border-radius:var(--radius-custom); border:1px solid var(--parla-border); margin-bottom:10px;">
                <label class="field-label" style="margin-bottom:4px;">Bedenler &amp; Stok Durumu</label>
                <div class="sizes-matrix">${sizesHTML || '<span style="font-size:12px; color:var(--parla-muted);">Henüz beden eklenmedi. Aşağıdan hızlıca seçebilirsiniz:</span>'}</div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px; padding-top:8px; border-top:1px dashed var(--parla-border);">
                  <span style="font-size:11.5px; color:var(--parla-muted);">Hızlı Beden Ekle:</span>
                  ${STANDARD_SIZES.map(std => `
                    <button type="button" class="btn-text" style="font-size:11.5px;" data-quick-add-size="${vIdx}:${std}">+${std}</button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- IMAGES MANAGEMENT -->
            <div class="col-12">
              <label class="field-label">${hasColors ? `Bu Rengin Görselleri` : `Ürün Görselleri`} (${(v.images || []).length} adet)</label>
              <div class="variant-images-list">
                ${imagesHTML || '<div style="font-size:12px; color:var(--parla-muted); padding:8px 0;">Henüz görsel eklenmedi.</div>'}
              </div>

              <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:12px; padding-top:10px; border-top:1px dashed var(--parla-border);">
                <label class="btn-text" style="cursor:pointer; font-weight:600;">
                  + Bilgisayardan Fotoğraf Yükle
                  <input type="file" accept="image/*" multiple style="display:none;" data-upload-file="${vIdx}" />
                </label>

                <div style="display:flex; align-items:center; gap:6px;">
                  <select class="form-select" style="width:auto; padding:6px 10px; font-size:12px;" data-library-select="${vIdx}">
                    <option value="">Instagram / Sunucu Kütüphanesinden Seç...</option>
                    ${mediaOptions}
                  </select>
                  <button type="button" class="btn-text" data-add-library-img="${vIdx}">Ekle</button>
                </div>

                <div style="display:flex; align-items:center; gap:6px;">
                  <input type="text" class="form-input" style="width:200px; padding:6px 10px; font-size:12px;" placeholder="Veya Görsel URL yapıştır..." data-custom-img-url="${vIdx}" />
                  <button type="button" class="btn-text" data-add-url-img="${vIdx}">URL Ekle</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    bindVariantEditorEvents(container);
  }

  function bindVariantEditorEvents(container) {
    // Text / Color fields change
    container.querySelectorAll('[data-var-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const [vIdxStr, field] = input.getAttribute('data-var-field').split(':');
        const vIdx = Number(vIdxStr);
        if (field === 'colorHex' || field === 'colorHexText') {
          editingVariants[vIdx].colorHex = e.target.value;
        } else {
          editingVariants[vIdx][field] = e.target.value;
        }
      });
      input.addEventListener('change', () => renderVariantsEditor());
    });

    // Remove Variant
    container.querySelectorAll('[data-remove-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vIdx = Number(btn.getAttribute('data-remove-variant'));
        editingVariants.splice(vIdx, 1);
        renderVariantsEditor();
      });
    });

    // Make image cover (move to index 0)
    container.querySelectorAll('[data-make-cover]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [vIdx, imgIdx] = btn.getAttribute('data-make-cover').split(':').map(Number);
        const imgs = editingVariants[vIdx].images;
        const [picked] = imgs.splice(imgIdx, 1);
        imgs.unshift(picked);
        renderVariantsEditor();
      });
    });

    // Remove image
    container.querySelectorAll('[data-remove-img]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [vIdx, imgIdx] = btn.getAttribute('data-remove-img').split(':').map(Number);
        editingVariants[vIdx].images.splice(imgIdx, 1);
        renderVariantsEditor();
      });
    });

    // Toggle size stock
    container.querySelectorAll('[data-toggle-stock]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const [vIdx, sIdx] = chk.getAttribute('data-toggle-stock').split(':').map(Number);
        editingVariants[vIdx].sizes[sIdx].inStock = e.target.checked;
      });
    });

    // Remove size
    container.querySelectorAll('[data-remove-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [vIdx, sIdx] = btn.getAttribute('data-remove-size').split(':').map(Number);
        editingVariants[vIdx].sizes.splice(sIdx, 1);
        renderVariantsEditor();
      });
    });

    // Quick add size
    container.querySelectorAll('[data-quick-add-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [vIdxStr, sizeName] = btn.getAttribute('data-quick-add-size').split(':');
        const vIdx = Number(vIdxStr);
        const exists = (editingVariants[vIdx].sizes || []).some(s => s.size === sizeName);
        if (!exists) {
          editingVariants[vIdx].sizes.push({ size: sizeName, inStock: true });
          renderVariantsEditor();
        }
      });
    });

    // Upload image from computer
    container.querySelectorAll('[data-upload-file]').forEach(fileInput => {
      fileInput.addEventListener('change', async (e) => {
        const vIdx = Number(fileInput.getAttribute('data-upload-file'));
        const files = Array.from(e.target.files || []);
        for (const file of files) {
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: file.name, dataUrl })
            });
            const uploaded = await res.json();
            if (uploaded.url) {
              editingVariants[vIdx].images.push(uploaded.url);
              if (!mediaLibrary.includes(uploaded.url)) mediaLibrary.push(uploaded.url);
            }
          } catch (err) {
            showToast('Görsel yüklenemedi.');
          }
        }
        renderVariantsEditor();
      });
    });

    // Add from library
    container.querySelectorAll('[data-add-library-img]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vIdx = Number(btn.getAttribute('data-add-library-img'));
        const sel = container.querySelector(`[data-library-select="${vIdx}"]`);
        if (sel && sel.value) {
          editingVariants[vIdx].images.push(sel.value);
          renderVariantsEditor();
        }
      });
    });

    // Add custom image URL
    container.querySelectorAll('[data-add-url-img]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vIdx = Number(btn.getAttribute('data-add-url-img'));
        const inp = container.querySelector(`[data-custom-img-url="${vIdx}"]`);
        if (inp && inp.value.trim()) {
          editingVariants[vIdx].images.push(inp.value.trim());
          renderVariantsEditor();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAdminData();

    // Admin Tabs switching
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-admin-tab');
        document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('tabProducts').style.display = tab === 'products' ? 'block' : 'none';
        document.getElementById('tabCategories').style.display = tab === 'categories' ? 'block' : 'none';
        document.getElementById('tabEvaluation').style.display = tab === 'evaluation' ? 'block' : 'none';
      });
    });

    // New Product button
    document.getElementById('newProductBtn').addEventListener('click', () => openEditorModal(null));
    document.getElementById('closeEditorBtn').addEventListener('click', closeEditorModal);
    document.getElementById('cancelEditorBtn').addEventListener('click', closeEditorModal);

    // Category modal triggers
    document.getElementById('newCategoryBtn').addEventListener('click', () => openCategoryModal(null));
    document.getElementById('quickAddCatBtn').addEventListener('click', () => openCategoryModal(null));
    document.getElementById('closeCategoryBtn').addEventListener('click', closeCategoryModal);
    document.getElementById('cancelCategoryBtn').addEventListener('click', closeCategoryModal);

    // Save Category Form
    document.getElementById('categoryEditorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cid = document.getElementById('editCategoryId').value;
      const payload = {
        name: document.getElementById('editCategoryName').value.trim(),
        image: document.getElementById('editCategoryImage').value.trim() || '/images/brand/parla-logo.jpg',
        featured: document.getElementById('catFeatured').checked,
        defaultHasColors: document.getElementById('catDefColors').checked,
        defaultHasSizes: document.getElementById('catDefSizes').checked,
        defaultHasFabricInfo: document.getElementById('catDefFabric').checked,
        defaultHasDescription: document.getElementById('catDefDesc').checked
      };

      try {
        const url = cid ? `/api/categories/${cid}` : '/api/categories';
        const method = cid ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          closeCategoryModal();
          showToast(cid ? 'Kategori güncellendi.' : 'Yeni kategori eklendi.');
          await loadAdminData();
          if (!cid) {
            // Select the newly added category in the product editor
            const addedCat = (catalog.categories || []).find(c => c.name.toLowerCase() === payload.name.toLowerCase());
            if (addedCat) {
              const editCatSel = document.getElementById('editCategory');
              if (editCatSel) editCatSel.value = addedCat.id || addedCat.slug;
            }
          }
        } else {
          showToast('Kategori kaydedilemedi.');
        }
      } catch (err) {
        showToast('Sunucu hatası oluştu.');
      }
    });

    // Category dropdown change in Product Editor -> auto-apply category defaults for new product
    document.getElementById('editCategory').addEventListener('change', (e) => {
      const isNew = !document.getElementById('editProductId').value;
      if (!isNew) return;
      const catVal = e.target.value;
      const catObj = (catalog.categories || []).find(c => (c.id || c.slug) === catVal);
      if (catObj) {
        editingFeatures.hasColors = catObj.defaultHasColors !== false;
        editingFeatures.hasSizes = catObj.defaultHasSizes !== false;
        editingFeatures.hasFabricInfo = catObj.defaultHasFabricInfo !== false;
        editingFeatures.hasDescription = catObj.defaultHasDescription !== false;
        syncFeatureToggleUI();
      }
    });

    // Feature Toggles Click Listeners
    document.getElementById('btnToggleColors').addEventListener('click', (e) => {
      e.preventDefault();
      editingFeatures.hasColors = !editingFeatures.hasColors;
      syncFeatureToggleUI();
    });

    document.getElementById('btnToggleSizes').addEventListener('click', (e) => {
      e.preventDefault();
      editingFeatures.hasSizes = !editingFeatures.hasSizes;
      syncFeatureToggleUI();
    });

    document.getElementById('btnToggleFabric').addEventListener('click', (e) => {
      e.preventDefault();
      editingFeatures.hasFabricInfo = !editingFeatures.hasFabricInfo;
      syncFeatureToggleUI();
    });

    document.getElementById('btnToggleDesc').addEventListener('click', (e) => {
      e.preventDefault();
      editingFeatures.hasDescription = !editingFeatures.hasDescription;
      syncFeatureToggleUI();
    });

    // Add Variant button
    document.getElementById('addVariantBtn').addEventListener('click', () => {
      editingVariants.push({
        id: 'var-' + Date.now(),
        colorName: 'Yeni Renk',
        colorHex: '#C5A059',
        trendyolUrl: '',
        images: [],
        sizes: editingFeatures.hasSizes ? [
          { size: 'S', inStock: true },
          { size: 'M', inStock: true },
          { size: 'L', inStock: true }
        ] : []
      });
      renderVariantsEditor();
    });

    // Save Product Form
    document.getElementById('productEditorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editProductId').value;
      const payload = {
        title: document.getElementById('editTitle').value.trim(),
        category: document.getElementById('editCategory').value,
        code: document.getElementById('editCode').value.trim(),
        price: Number(document.getElementById('editPrice').value),
        oldPrice: document.getElementById('editOldPrice').value ? Number(document.getElementById('editOldPrice').value) : null,
        trendyolUrl: document.getElementById('editTrendyolUrl').value.trim(),
        hasColors: editingFeatures.hasColors,
        hasSizes: editingFeatures.hasSizes,
        hasFabricInfo: editingFeatures.hasFabricInfo,
        hasDescription: editingFeatures.hasDescription,
        fabricInfo: editingFeatures.hasFabricInfo ? document.getElementById('editFabric').value.trim() : '',
        isNew: document.getElementById('editIsNew').checked,
        featured: document.getElementById('editFeatured').checked,
        description: editingFeatures.hasDescription ? document.getElementById('editDescription').value.trim() : '',
        variants: editingVariants
      };

      try {
        const url = id ? `/api/products/${id}` : '/api/products';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          closeEditorModal();
          showToast(id ? 'Ürün başarıyla güncellendi.' : 'Yeni ürün başarıyla eklendi.');
          loadAdminData();
        } else {
          showToast('Ürün kaydedilirken hata oluştu.');
        }
      } catch (err) {
        showToast('Sunucu hatası oluştu.');
      }
    });
  });
})();
