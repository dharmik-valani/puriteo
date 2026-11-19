(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.BogoStickyCart = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var ATC_SELECTOR = [
    '[data-btn-addtocart]',
    '[data-btn-add-to-cart]',
    '.product-form__submit',
    'button[name="add"]',
    'input[name="add"]',
    '[data-add-to-cart]',
    '.add-to-cart-btn',
    '.button-ATC',
    '[data-quickshop-popup]'
  ].join(', ');

  function remainingCount(required, slots) {
    var count = Array.isArray(slots) ? slots.filter(Boolean).length : 0;
    var need = Number(required) || 0;
    return Math.max(0, need - count);
  }

  function buildProgressMessage(template, count) {
    return String(template || '').replace(/\[count\]/g, String(count));
  }

  function normalizeItem(item) {
    if (!item) return null;
    var variantId = Number(item.variantId);
    var productId = Number(item.productId);
    if (!Number.isInteger(variantId) || variantId <= 0) return null;
    if (!Number.isInteger(productId) || productId <= 0) return null;
    var quantity = Number(item.quantity) || 1;
    if (quantity < 1) quantity = 1;
    return {
      productId: productId,
      variantId: variantId,
      title: String(item.title || 'Product'),
      variantTitle: item.variantTitle && item.variantTitle !== 'Default Title' ? String(item.variantTitle) : '',
      image: item.image ? String(item.image) : '',
      priceCents: Number(item.priceCents) || 0,
      quantity: quantity,
      available: item.available !== false
    };
  }

  function normalizeSlots(saved, required) {
    var count = Math.max(0, Number(required) || 0);
    var slots = [];
    var index;
    for (index = 0; index < count; index += 1) slots.push(null);
    if (!Array.isArray(saved)) return slots;

    var units = [];
    saved.forEach(function (entry) {
      var normalized = normalizeItem(entry);
      if (!normalized) return;
      var copies = Math.max(1, normalized.quantity);
      var copy;
      for (copy = 0; copy < copies; copy += 1) {
        units.push({
          productId: normalized.productId,
          variantId: normalized.variantId,
          title: normalized.title,
          variantTitle: normalized.variantTitle,
          image: normalized.image,
          priceCents: normalized.priceCents,
          quantity: 1,
          available: normalized.available
        });
      }
    });

    units.slice(0, count).forEach(function (unit, unitIndex) {
      slots[unitIndex] = unit;
    });
    return slots;
  }

  function firstEmptyIndex(slots) {
    return slots.findIndex(function (slot) { return !slot; });
  }

  function addUnits(slots, startIndex, item, units, mode) {
    var next = slots.map(function (slot) { return slot ? Object.assign({}, slot) : null; });
    var normalized = normalizeItem(Object.assign({}, item, { quantity: 1 }));
    var requested = Math.max(1, Number(units) || 1);
    var placed = 0;
    if (!normalized) return { slots: next, placed: 0, leftover: requested };

    if (mode === 'replace' && startIndex >= 0 && startIndex < next.length) {
      next[startIndex] = Object.assign({}, normalized);
      return { slots: next, placed: 1, leftover: 0 };
    }

    var order = [];
    if (startIndex >= 0 && startIndex < next.length) order.push(startIndex);
    var cursor;
    for (cursor = 0; cursor < next.length; cursor += 1) {
      if (cursor !== startIndex) order.push(cursor);
    }

    order.forEach(function (slotIndex) {
      if (placed >= requested) return;
      if (next[slotIndex]) return;
      next[slotIndex] = Object.assign({}, normalized);
      placed += 1;
    });

    return { slots: next, placed: placed, leftover: requested - placed };
  }

  function canSubmit(slots, required, submitting) {
    if (submitting) return false;
    var need = Number(required) || 0;
    if (need < 1 || !Array.isArray(slots) || slots.length !== need) return false;
    var selected = slots.filter(Boolean);
    if (selected.length !== need) return false;
    return selected.every(function (item) {
      return item.available !== false && Number(item.variantId) > 0 && Number(item.productId) > 0;
    });
  }

  function buildCartPayload(slots, required) {
    if (!canSubmit(slots, required, false)) {
      var selected = Array.isArray(slots) ? slots.filter(Boolean) : [];
      var unavailable = selected.some(function (item) { return item.available === false; });
      return { ok: false, reason: unavailable ? 'unavailable' : 'incomplete' };
    }

    var grouped = new Map();
    slots.forEach(function (item) {
      var id = Number(item.variantId);
      var quantity = Number(item.quantity) || 1;
      grouped.set(id, (grouped.get(id) || 0) + quantity);
    });

    return {
      ok: true,
      items: Array.from(grouped, function (entry) {
        return {
          id: entry[0],
          quantity: entry[1],
          properties: {
            '_bogo_offer': 'bogo_bundle'
          }
        };
      })
    };
  }

  function priceToCents(price) {
    if (typeof price === 'number') return Math.round(price);
    var raw = String(price == null ? '' : price).trim();
    if (!raw) return 0;
    if (raw.indexOf('.') >= 0) {
      var decimal = parseFloat(raw.replace(/[^0-9.]/g, ''));
      return Number.isFinite(decimal) ? Math.round(decimal * 100) : 0;
    }
    var cents = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(cents) ? cents : 0;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(cents, config) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      try {
        return window.Shopify.formatMoney(cents, config.moneyFormat || window.money_format);
      } catch (error) { }
    }
    var symbol = config.currencySymbol || '₹';
    return symbol + ' ' + (Number(cents || 0) / 100).toFixed(2);
  }

  function parseJsonScript(rootEl, selector) {
    var node = rootEl.querySelector(selector);
    if (!node) return null;
    return JSON.parse(node.textContent);
  }

  function variantImage(variant, productImage) {
    if (variant && variant.featured_image) {
      if (typeof variant.featured_image === 'string') return variant.featured_image;
      if (variant.featured_image.src) return variant.featured_image.src;
    }
    if (variant && variant.image) {
      if (typeof variant.image === 'string') return variant.image;
      if (variant.image.src) return variant.image.src;
    }
    return productImage || '';
  }

  function mapCatalogProduct(product) {
    if (!product || !product.id) return null;
    var image = '';
    if (typeof product.image === 'string') image = product.image;
    else if (product.images && product.images[0] && product.images[0].src) image = product.images[0].src;
    else if (product.featured_image && product.featured_image.src) image = product.featured_image.src;

    var variants = (product.variants || []).map(function (variant) {
      return {
        id: Number(variant.id),
        title: variant.title || '',
        available: variant.available !== false,
        price: priceToCents(variant.price),
        image: variantImage(variant, image)
      };
    }).filter(function (variant) { return Number.isInteger(variant.id) && variant.id > 0; });

    if (!variants.length) return null;
    return {
      id: Number(product.id),
      title: product.title || 'Product',
      image: image,
      variants: variants
    };
  }

  function productRoot(node) {
    if (!node || !node.closest) return node || null;
    return node.closest('[data-json-product]') || node.closest('.product-item') || node.closest('.quickshop-popup, .halo-quick-shop-popup, .quickView, product-form') || node;
  }

  function numericId(value) {
    var text = String(value == null ? '' : value).trim();
    return /^\d+$/.test(text) ? text : '';
  }

  function checkedOptionValues(form) {
    if (!form) return [];
    return Array.from(form.querySelectorAll('input.single-option:checked, input[type="radio"]:checked')).map(function (input) {
      return input.value;
    }).filter(Boolean);
  }

  function matchVariant(variants, options) {
    if (!variants || !options.length) return null;
    return variants.find(function (variant) {
      var parts = [variant.option1, variant.option2, variant.option3].filter(function (part) { return part; });
      if (!parts.length && variant.title) parts = String(variant.title).split(/\s+\/\s+/);
      return options.every(function (value) {
        return parts.some(function (part) { return String(part) === String(value); });
      });
    }) || null;
  }

  function variantIdFromForm(form, jsonData) {
    if (!form) return '';
    var select = form.querySelector('select[name="id"]');
    if (select) {
      var fromValue = numericId(select.value);
      if (fromValue) return fromValue;
      var option = select.selectedOptions && select.selectedOptions[0];
      if (option && !option.disabled) {
        var fromData = numericId(option.getAttribute('data-value') || option.value);
        if (fromData) return fromData;
      }
    }
    var idInput = form.querySelector('input[name="id"]');
    if (idInput) {
      var fromInput = numericId(idInput.value);
      if (fromInput) return fromInput;
    }
    if (jsonData && jsonData.variants) {
      var matched = matchVariant(jsonData.variants, checkedOptionValues(form));
      if (matched) return matched.id;
    }
    return '';
  }

  function readCardProduct(card, form) {
    if (form && form.closest) {
      var formOwner = form.closest('[data-json-product]');
      if (formOwner) card = formOwner;
    }
    if (card && card.closest && !(card.hasAttribute && card.hasAttribute('data-json-product'))) {
      var owner = card.closest('[data-json-product]');
      if (owner) card = owner;
    }
    if (!card) return null;
    var jsonData = null;
    var raw = card.getAttribute('data-json-product');
    if (raw) {
      try { jsonData = JSON.parse(raw); } catch (error) { jsonData = null; }
    }

    var productId = jsonData && jsonData.id ? Number(jsonData.id) : 0;
    if (!productId) {
      var idAttr = card.getAttribute('data-product-id') || '';
      var idMatch = String(idAttr).match(/(\d+)/);
      if (idMatch) productId = Number(idMatch[1]);
    }

    var variantId = variantIdFromForm(form, jsonData);
    if (!variantId && jsonData && jsonData.variants) {
      var firstAvailable = jsonData.variants.find(function (variant) { return variant.available !== false; }) || jsonData.variants[0];
      if (firstAvailable) variantId = firstAvailable.id;
    }

    var matched = null;
    if (jsonData && jsonData.variants) {
      matched = jsonData.variants.find(function (variant) {
        return String(variant.id) === String(variantId);
      }) || jsonData.variants[0];
      if (matched) variantId = matched.id;
    }

    var titleNode = card.querySelector('.card-title, .product-title, .card__heading, h3, a.title');
    var title = jsonData && jsonData.title ? jsonData.title : '';
    if (!title && titleNode) title = titleNode.textContent.trim();

    var image = matched ? variantImage(matched, '') : '';
    if (!image) {
      var imageNode = card.querySelector('.card-media img, .card-product img, img');
      if (imageNode) image = imageNode.getAttribute('data-src') || imageNode.currentSrc || imageNode.src || '';
    }

    var priceCents = matched && matched.price != null ? priceToCents(matched.price) : 0;
    if (!priceCents) {
      var priceNode = card.querySelector('.price-item--sale, .price-item--regular, .price, .card-price, .money');
      if (priceNode) priceCents = priceToCents(priceNode.textContent);
    }

    var variantTitle = '';
    if (matched && matched.title && matched.title !== 'Default Title') variantTitle = matched.title;

    var qtyNode = (form || card).querySelector('input[name="quantity"][data-product-card-quantity], input[name="quantity"]');
    var quantity = qtyNode ? parseInt(qtyNode.value, 10) || 1 : 1;
    var available = !matched || matched.available !== false;

    return mapCatalogProduct({
      id: productId,
      title: title || 'Product',
      image: image,
      variants: [{
        id: variantId,
        title: variantTitle,
        available: available,
        price: priceCents,
        image: image
      }]
    });
  }

  function calculateBogoTotals(slots, config) {
    var unitPrices = [];
    (slots || []).forEach(function (item) {
      if (!item) return;
      var qty = item.quantity || 1;
      for (var i = 0; i < qty; i++) {
        unitPrices.push(Number(item.priceCents) || 0);
      }
    });

    var originalTotal = unitPrices.reduce(function (sum, p) { return sum + p; }, 0);
    var count = unitPrices.length;

    var payableTotal = originalTotal;
    var savings = 0;

    var req = Number(config.required) || 2;
    var freeQty = Number(config.free) || 1;

    // When the deal is unlocked (all required spots filled or count >= req)
    if (count >= req && freeQty > 0) {
      var sorted = unitPrices.slice().sort(function (a, b) { return b - a; });
      var freeCount = Math.min(freeQty, count);
      var paidCount = Math.max(0, count - freeCount);
      payableTotal = 0;
      for (var j = 0; j < paidCount; j++) {
        payableTotal += sorted[j];
      }
      savings = originalTotal - payableTotal;
    }

    return {
      count: count,
      originalTotal: originalTotal,
      payableTotal: payableTotal,
      savings: savings,
      isUnlocked: count >= req
    };
  }

  function offerApi() {
    var node = document.querySelector('[data-bogo-offer]');
    return node && node._bogoApi ? node._bogoApi : null;
  }

  function mount(rootEl) {
    if (!rootEl || rootEl.nodeType !== 1) return;
    if (rootEl.dataset.bogoMounted === 'true') return;
    rootEl.dataset.bogoMounted = 'true';

    var config = parseJsonScript(rootEl, '[data-bogo-config]');
    if (!config || !config.required) return;

    var initialCatalog = parseJsonScript(rootEl, '[data-bogo-catalog]') || [];
    var catalog = new Map();
    initialCatalog.map(mapCatalogProduct).filter(Boolean).forEach(function (product) {
      catalog.set(product.id, product);
    });

    var slotsNode = rootEl.querySelector('[data-bogo-slots]');
    var bannerNode = rootEl.querySelector('[data-bogo-banner]');
    var submitNode = rootEl.querySelector('[data-bogo-submit]');
    var submitText = rootEl.querySelector('[data-bogo-submit-text]');
    var spinnerNode = rootEl.querySelector('[data-bogo-spinner]');
    var statusNode = rootEl.querySelector('[data-bogo-status]');
    var pickerNode = rootEl.querySelector('[data-bogo-picker]');
    var pickerList = rootEl.querySelector('[data-bogo-picker-list]');
    var totalBarNode = rootEl.querySelector('[data-bogo-total-bar]');
    var totalPriceNode = rootEl.querySelector('[data-bogo-total-price]');
    var totalCompareNode = rootEl.querySelector('[data-bogo-total-compare]');
    var totalBadgeNode = rootEl.querySelector('[data-bogo-total-badge]');
    var totalLabelNode = rootEl.querySelector('[data-bogo-total-label]');
    var storageKey = 'puriteo_bogo_slots_v2_' + config.sectionId;
    var submitting = false;
    var justAdded = false;
    var pendingIndex = -1;
    var pendingMode = 'fill';
    var catalogReady = !config.collectionHandle;

    function setStatus(message, tone) {
      if (!statusNode) return;
      statusNode.textContent = message || '';
      statusNode.classList.toggle('is-error', tone === 'error');
      statusNode.classList.toggle('is-success', tone === 'success');
      statusNode.hidden = !message;
    }

    function loadSlots() {
      var saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (error) { saved = null; }
      if (!saved) {
        try {
          var legacy = JSON.parse(sessionStorage.getItem('puriteo_bogo_box_items') || 'null');
          if (Array.isArray(legacy)) saved = legacy;
        } catch (error) { saved = null; }
      }
      return normalizeSlots(saved, config.required);
    }

    var slots = loadSlots();

    function saveSlots() {
      try { sessionStorage.setItem(storageKey, JSON.stringify(slots)); } catch (error) { }
    }

    function selectedCount() {
      return slots.filter(Boolean).length;
    }

    function render() {
      var remaining = remainingCount(config.required, slots);
      var complete = canSubmit(slots, config.required, false);
      var ready = complete && !submitting;
      if (bannerNode && config.showProgress) {
        bannerNode.hidden = false;
        bannerNode.textContent = remaining === 0
          ? config.unlockedMessage
          : buildProgressMessage(config.progressTemplate, remaining);
      }
      if (submitNode) {
        submitNode.classList.toggle('is-disabled', !complete);
        submitNode.classList.toggle('is-loading', submitting);
        submitNode.classList.toggle('is-success', justAdded);
        submitNode.setAttribute('aria-disabled', ready ? 'false' : 'true');
        submitNode.dataset.state = submitting ? 'loading' : (justAdded ? 'added' : (ready ? 'ready' : 'locked'));
      }
      if (submitText) {
        if (submitting) submitText.textContent = config.loadingText;
        else if (justAdded) submitText.textContent = 'Added to cart ✓';
        else if (ready) submitText.textContent = config.buttonText;
        else submitText.textContent = buildProgressMessage(config.disabledText, remaining);
      }
      if (spinnerNode) spinnerNode.hidden = !submitting;
      rootEl.dataset.selected = String(selectedCount());
      rootEl.dataset.remaining = String(remaining);
      rootEl.dataset.required = String(config.required);

      var totals = calculateBogoTotals(slots, config);
      if (totalPriceNode) {
        totalPriceNode.textContent = formatMoney(totals.payableTotal, config);
      }
      if (totalCompareNode) {
        if (totals.savings > 0) {
          totalCompareNode.textContent = formatMoney(totals.originalTotal, config);
          totalCompareNode.hidden = false;
        } else {
          totalCompareNode.textContent = '';
          totalCompareNode.hidden = true;
        }
      }
      if (totalBadgeNode) {
        if (totals.savings > 0) {
          totalBadgeNode.textContent = 'Save ' + formatMoney(totals.savings, config) + ' (BOGO)';
          totalBadgeNode.hidden = false;
        } else {
          totalBadgeNode.textContent = '';
          totalBadgeNode.hidden = true;
        }
      }

      if (!slotsNode) return;
      slotsNode.innerHTML = '';
      slots.forEach(function (item, index) {
        var slot = document.createElement(item ? 'div' : 'button');
        slot.className = 'bogo-offer__slot' + (item ? ' is-filled' : ' is-empty');
        slot.setAttribute('data-bogo-slot', String(index));
        if (!item) {
          slot.type = 'button';
          slot.setAttribute('aria-label', 'Select product ' + (index + 1));
          slot.innerHTML = '<span class="bogo-offer__plus" aria-hidden="true">+</span>';
        } else {
          var price = formatMoney(item.priceCents * item.quantity, config);
          var variant = item.variantTitle ? '<span class="bogo-offer__variant">' + escapeHtml(item.variantTitle) + '</span>' : '';
          var image = config.showImages && item.image
            ? '<img class="bogo-offer__image" src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title) + '">'
            : '';
          var priceHtml = config.showPrices
            ? '<span class="bogo-offer__price">x' + item.quantity + ' - ' + escapeHtml(price) + '</span>'
            : '';
          var remove = config.showRemove
            ? '<button type="button" class="bogo-offer__remove" data-bogo-remove="' + index + '" aria-label="Remove ' + escapeHtml(item.title) + '">' +
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>' +
            '</button>'
            : '';
          slot.innerHTML = remove +
            '<button type="button" class="bogo-offer__filled" data-bogo-replace="' + index + '">' +
            image +
            '<span class="bogo-offer__copy"><span class="bogo-offer__title">' + escapeHtml(item.title) + '</span>' +
            variant + priceHtml + '</span></button>';

          var removeBtn = slot.querySelector('[data-bogo-remove]');
          if (removeBtn) {
            removeBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
              var idx = Number(this.getAttribute('data-bogo-remove'));
              if (!isNaN(idx) && idx >= 0 && idx < slots.length) {
                var cleared = slots.map(function (s, i) { return i === idx ? null : s; });
                remember(cleared, '', '');
              }
            });
          }
        }
        slotsNode.appendChild(slot);
      });

      var reopenBtn = document.getElementById('bogo-reopen-' + config.sectionId) || document.querySelector('[data-bogo-reopen-bar]');
      if (reopenBtn) {
        var reopenText = reopenBtn.querySelector('[data-bogo-reopen-text]');
        if (reopenText) {
          reopenText.textContent = remaining === 0 ? 'BOGO Deal Unlocked! 🎁' : 'BOGO Offer (' + selectedCount() + '/' + config.required + ')';
        }
      }

      syncHeight();
    }

    function syncHeight() {
      if (rootEl.classList.contains('is-minimized')) {
        document.documentElement.style.setProperty('--bogo-offer-height', '0px');
        return;
      }
      var height = Math.ceil(rootEl.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--bogo-offer-height', height + 'px');
    }

    function remember(nextSlots, message, tone) {
      slots = nextSlots;
      saveSlots();
      render();
      setStatus(message || '', tone || '');
    }

    function allowed(productId) {
      if (!config.restrictCollection) return true;
      return catalog.has(Number(productId));
    }

    function ensureCatalog() {
      if (catalogReady || !config.collectionHandle) {
        catalogReady = true;
        return Promise.resolve();
      }
      var rootUrl = config.rootUrl || '/';
      if (rootUrl.charAt(rootUrl.length - 1) !== '/') rootUrl += '/';
      var url = rootUrl + 'collections/' + encodeURIComponent(config.collectionHandle) + '/products.json?limit=250';
      return fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (response) { return response.ok ? response.json() : { products: [] }; })
        .then(function (data) {
          (data.products || []).map(mapCatalogProduct).filter(Boolean).forEach(function (product) {
            catalog.set(product.id, product);
          });
        })
        .catch(function () { })
        .then(function () { catalogReady = true; });
    }

    function pageProducts() {
      var found = [];
      document.querySelectorAll('[data-json-product]').forEach(function (card) {
        if (card.closest('.bogo-offer')) return;
        var product = readCardProduct(card);
        if (!product || !allowed(product.id)) return;
        if (!found.some(function (item) { return item.id === product.id; })) found.push(product);
      });
      return found;
    }

    function pickerProducts() {
      var products = Array.from(catalog.values()).filter(function (product) { return allowed(product.id); });
      if (!config.restrictCollection) {
        pageProducts().forEach(function (product) {
          if (!products.some(function (item) { return item.id === product.id; })) products.push(product);
        });
      }
      return products;
    }

    function closePicker() {
      if (!pickerNode) return;
      pickerNode.hidden = true;
      document.body.classList.remove('bogo-offer-picker-open');
    }

    function openPicker(index, mode) {
      pendingIndex = index;
      pendingMode = mode;
      ensureCatalog().then(function () {
        var products = pickerProducts();
        if (!products.length) {
          var target = document.querySelector('.product-item, [data-json-product], product-tabs-section');
          if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setStatus(config.chooseMessage, '');
          return;
        }
        if (!pickerList || !pickerNode) return;
        pickerList.innerHTML = products.map(function (product, productIndex) {
          var variantOptions = product.variants.map(function (variant, variantIndex) {
            var label = variant.title && variant.title !== 'Default Title' ? variant.title : product.title;
            return '<option value="' + variantIndex + '"' + (variant.available ? '' : ' disabled') + '>' +
              escapeHtml(label + (variant.available ? '' : ' - Sold out')) + '</option>';
          }).join('');
          var soldOut = product.variants.every(function (variant) { return !variant.available; });
          return '<div class="bogo-offer-picker__product' + (soldOut ? ' is-sold-out' : '') + '" data-picker-product="' + productIndex + '">' +
            (product.image ? '<img src="' + escapeHtml(product.image) + '" alt="">' : '') +
            '<span class="bogo-offer-picker__meta"><span>' + escapeHtml(product.title) + '</span>' +
            (product.variants.length > 1 ? '<select data-picker-variant>' + variantOptions + '</select>' : '') +
            '</span><button type="button" data-picker-add="' + productIndex + '"' + (soldOut ? ' disabled' : '') + '>Select</button></div>';
        }).join('');
        pickerList._products = products;
        pickerNode.hidden = false;
        document.body.classList.add('bogo-offer-picker-open');
      });
    }

    function chooseVariant(product, variantIndex) {
      var variant = product.variants[variantIndex] || product.variants.find(function (item) { return item.available; });
      if (!variant || !variant.available) {
        setStatus(config.soldOutMessage, 'error');
        return;
      }
      var result = addUnits(slots, pendingIndex, {
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        variantTitle: variant.title,
        image: variant.image || product.image,
        priceCents: variant.price,
        quantity: 1,
        available: true
      }, 1, pendingMode);
      if (!result.placed) {
        setStatus(config.fullMessage, 'error');
        return;
      }
      closePicker();
      remember(result.slots, '', '');
    }

    function addFromCard(card, quantity, forcedVariantId, form) {
      var product = readCardProduct(card, form);
      if (!product) {
        setStatus(config.invalidMessage, 'error');
        return;
      }
      if (forcedVariantId) {
        var forcedId = Number(forcedVariantId);
        var matchedVariant = product.variants.find(function (variant) { return variant.id === forcedId; });
        if (matchedVariant) product.variants.unshift(matchedVariant);
        else if (product.variants[0]) product.variants[0].id = forcedId;
      }
      var apply = function () {
        if (!allowed(product.id)) {
          setStatus(config.collectionMessage, 'error');
          return;
        }
        var variant = product.variants[0];
        if (!variant || !variant.available) {
          setStatus(config.soldOutMessage, 'error');
          return;
        }
        var start = firstEmptyIndex(slots);
        if (start < 0) {
          setStatus(config.fullMessage, 'error');
          return;
        }
        var result = addUnits(slots, start, {
          productId: product.id,
          variantId: variant.id,
          title: product.title,
          variantTitle: variant.title,
          image: variant.image || product.image,
          priceCents: variant.price,
          quantity: 1,
          available: true
        }, quantity || 1, 'fill');
        if (!result.placed) {
          setStatus(config.fullMessage, 'error');
          return;
        }
        var note = result.leftover > 0 ? config.partialMessage : '';
        closeQuickShop();
        remember(result.slots, note, note ? 'error' : '');
      };

      if (config.restrictCollection && !catalogReady) ensureCatalog().then(apply);
      else apply();
    }

    function closeQuickShop() {
      document.body.classList.remove('quick_shop_popup_mobile', 'show-mobile-options', 'quickshop-popup-show', 'quick-view-show', 'quickshop-list-view-show');
      document.querySelectorAll('.quickshop-popup-show, .quick-view-show, #halo-card-mobile-popup').forEach(function (node) {
        node.classList.remove('quickshop-popup-show', 'quick-view-show', 'show');
      });
      if (window.jQuery) {
        window.jQuery('body').removeClass('quick_shop_popup_mobile show-mobile-options quickshop-popup-show quick-view-show');
        window.jQuery('.quickshop-popup-show, .quick-view-show, #halo-card-mobile-popup').removeClass('quickshop-popup-show quick-view-show show');
      }
    }

    function refreshCart(cart) {
      document.querySelectorAll('[data-cart-count]').forEach(function (node) {
        node.textContent = cart.item_count;
      });
      document.querySelectorAll('[data-cart-text]').forEach(function (node) {
        var singular = window.cartStrings && window.cartStrings.item ? window.cartStrings.item : 'item';
        var plural = window.cartStrings && window.cartStrings.items ? window.cartStrings.items : 'items';
        node.textContent = cart.item_count === 1 ? singular : plural;
      });
      document.body.classList.add('cart-sidebar-show');
      if (window.jQuery) window.jQuery('body').addClass('cart-sidebar-show');
      var overlay = document.querySelector('.background-overlay');
      if (overlay) overlay.classList.remove('hold');
      if (window.halo && typeof window.halo.updateSidebarCart === 'function') {
        window.halo.updateSidebarCart(cart);
      } else if (window.sharedFunctions && typeof window.sharedFunctions.updateSidebarCart === 'function') {
        window.sharedFunctions.updateSidebarCart(cart);
      }
      document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
      document.dispatchEvent(new CustomEvent('cart-update', { detail: cart }));
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
    }

    function submitOffer() {
      if (submitting) return;
      var payload = buildCartPayload(slots, config.required);
      if (!payload.ok) {
        if (payload.reason === 'unavailable') setStatus(config.soldOutMessage, 'error');
        else setStatus(buildProgressMessage(config.validationMessage, remainingCount(config.required, slots)), 'error');
        render();
        return;
      }

      submitting = true;
      render();
      var rootUrl = config.rootUrl || '/';
      if (rootUrl.charAt(rootUrl.length - 1) !== '/') rootUrl += '/';

      fetch(rootUrl + 'cart.js', { headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) return { items: [] };
          return res.json().catch(function () { return { items: [] }; });
        })
        .then(function (cart) {
          var updates = {};
          var hasOldBogo = false;
          (cart.items || []).forEach(function (cartItem) {
            if (cartItem.properties && cartItem.properties['_bogo_offer'] === 'bogo_bundle') {
              updates[cartItem.key] = 0;
              hasOldBogo = true;
            }
          });

          if (hasOldBogo) {
            return fetch(rootUrl + 'cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ updates: updates })
            }).then(function (res) {
              return res.json().catch(function () { return {}; });
            });
          }
          return Promise.resolve();
        })
        .then(function () {
          return fetch(rootUrl + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: payload.items })
          });
        })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            if (!response.ok || data.status) {
              var message = data.description || data.message || config.errorMessage;
              throw new Error(message);
            }
            return data;
          });
        })
        .then(function () {
          return fetch(rootUrl + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (response) {
            if (!response.ok) throw new Error(config.errorMessage);
            return response.json();
          });
        })
        .then(function (cart) {
          saveSlots();
          refreshCart(cart);
          setStatus(config.successMessage, 'success');
          justAdded = true;
          setTimeout(function () {
            justAdded = false;
            setStatus('', '');
            render();
          }, 3000);
        })
        .catch(function (error) {
          setStatus(error && error.message ? error.message : config.errorMessage, 'error');
        })
        .then(function () {
          submitting = false;
          render();
        });
    }

    rootEl.addEventListener('click', function (event) {
      var removeButton = event.target.closest('[data-bogo-remove]');
      if (removeButton) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        var removeIndex = Number(removeButton.getAttribute('data-bogo-remove'));
        if (!isNaN(removeIndex) && removeIndex >= 0 && removeIndex < slots.length) {
          var cleared = slots.map(function (slot, index) { return index === removeIndex ? null : slot; });
          remember(cleared, '', '');
        }
        return;
      }

      var emptyButton = event.target.closest('.bogo-offer__slot.is-empty');
      if (emptyButton) {
        event.preventDefault();
        openPicker(Number(emptyButton.getAttribute('data-bogo-slot')), 'fill');
        return;
      }

      var replaceButton = event.target.closest('[data-bogo-replace]');
      if (replaceButton) {
        event.preventDefault();
        openPicker(Number(replaceButton.getAttribute('data-bogo-replace')), 'replace');
        return;
      }

      if (event.target.closest('[data-bogo-submit]')) {
        event.preventDefault();
        submitOffer();
      }
    });

    var closeBarBtn = rootEl.querySelector('[data-bogo-close-bar]');
    var reopenBtn = document.getElementById('bogo-reopen-' + config.sectionId) || document.querySelector('[data-bogo-reopen-bar]');

    function minimizeBar() {
      rootEl.classList.add('is-minimized');
      document.body.classList.add('bogo-offer-minimized');
      document.body.classList.remove('bogo-offer-active');
      document.documentElement.style.setProperty('--bogo-offer-height', '0px');
      if (reopenBtn) reopenBtn.hidden = false;
    }

    function reopenBar() {
      rootEl.classList.remove('is-minimized');
      document.body.classList.remove('bogo-offer-minimized');
      document.body.classList.add('bogo-offer-active');
      if (reopenBtn) reopenBtn.hidden = true;
      syncHeight();
    }

    if (closeBarBtn) {
      closeBarBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        minimizeBar();
      });
    }

    if (reopenBtn) {
      reopenBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        reopenBar();
      });
    }

    if (pickerNode) {
      pickerNode.addEventListener('click', function (event) {
        if (event.target.closest('[data-bogo-picker-close]')) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          closePicker();
          return;
        }
        var addButton = event.target.closest('[data-picker-add]');
        if (!addButton || !pickerList || !pickerList._products) return;
        event.preventDefault();
        var product = pickerList._products[Number(addButton.getAttribute('data-picker-add'))];
        if (!product) return;
        var row = addButton.closest('[data-picker-product]');
        var select = row ? row.querySelector('[data-picker-variant]') : null;
        chooseVariant(product, select ? Number(select.value) : 0);
      });
    }

    rootEl._bogoApi = {
      addFromCard: addFromCard,
      setStatus: setStatus,
      closePicker: closePicker,
      soldOutMessage: config.soldOutMessage
    };

    function isBogoCollectionPage() {
      if (document.body.classList.contains('template-product') || window.location.pathname.indexOf('/products/') !== -1) {
        return false;
      }
      return document.body.classList.contains('template-collection-bogo-offers') ||
        document.body.classList.contains('template-suffix-bogo-offers') ||
        window.location.pathname === '/collections/bogo-offers' ||
        window.location.pathname.indexOf('/collections/bogo-offers?') === 0;
    }

    if (!window.__bogoDocumentBound) {
      window.__bogoDocumentBound = true;

      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        var api = offerApi();
        if (api) api.closePicker();
      });

      document.addEventListener('click', function (event) {
        // Only run for collection -> bogo-offers template (never on product pages or other collections)
        if (!isBogoCollectionPage()) return;

        // Check if click is inside a product card/item
        var card = event.target.closest('.product-item, .product-card, [data-product-id]');
        if (!card) return;

        // Allow add to cart, sticky offer elements, swatches, wishlist, quickview popups
        if (event.target.closest('.bogo-offer, [data-bogo-offer], .bogo-offer-picker, ' + ATC_SELECTOR + ', .button-ATC, [data-btn-addtocart], [data-quickshop-popup], [data-open-quick-view-popup], [data-wishlist], .product-item__swatch, .quickshop-popup, .halo-quick-shop-popup, input, select, button')) {
          return;
        }

        // If target or any parent up to card is an anchor linking to a product page or has .card-link / .card-title
        var link = event.target.closest('a');
        if (link && (link.classList.contains('card-link') || link.classList.contains('card-title') || (link.getAttribute('href') && link.getAttribute('href').indexOf('/products/') !== -1))) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }
          return;
        }

        // If clicked on image or card-media
        if (event.target.closest('.card-media, .card-product__wrapper')) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }
          return;
        }
      }, true);

      document.addEventListener('click', function (event) {
        if (!isBogoCollectionPage()) return;
        var api = offerApi();
        if (!api || event.target.closest('.bogo-offer')) return;

        var button = event.target.closest(ATC_SELECTOR) || event.target.closest('.button-ATC, [data-quickshop-popup]');
        if (!button) return;
        if (button.classList.contains('is-notify-me')) return;

        // On BOGO offers collection: bypass select option popup entirely and add to sticky cart directly
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

        document.body.classList.remove('cart-sidebar-show', 'quick_shop_popup_mobile', 'show-mobile-options', 'quickshop-popup-show', 'quick-view-show', 'quickshop-list-view-show');
        if (window.jQuery) {
          window.jQuery('body').removeClass('cart-sidebar-show quick_shop_popup_mobile show-mobile-options quickshop-popup-show quick-view-show');
          window.jQuery('.quickshop-popup-show, .quick-view-show, #halo-card-mobile-popup').removeClass('quickshop-popup-show quick-view-show show');
        }
        var mobilePopup = document.getElementById('halo-card-mobile-popup');
        if (mobilePopup) mobilePopup.classList.remove('show');
        document.querySelectorAll('.variants-popup').forEach(function (popup) {
          popup.classList.remove('show');
          popup.style.display = 'none';
        });

        if (button.hasAttribute('disabled')) {
          api.setStatus(api.soldOutMessage || 'This product is sold out.', 'error');
          return;
        }
        var form = button.closest('form');
        var card = productRoot(form || button);
        var qtyNode = (form || card) && (form || card).querySelector('input[name="quantity"][data-product-card-quantity], input[name="quantity"]');
        api.addFromCard(card, qtyNode ? parseInt(qtyNode.value, 10) || 1 : 1, null, form);
      }, true);

      // Clean card button text on bogo-offers page
      function sanitizeBogoCardButtons() {
        if (!isBogoCollectionPage()) return;
        document.querySelectorAll('.product-item .button-ATC, .product-card .button-ATC, .product-item [data-quickshop-popup], .product-card [data-quickshop-popup]').forEach(function (btn) {
          if (btn.classList.contains('is-notify-me')) return;
          if (btn.hasAttribute('data-quickshop-popup')) {
            btn.removeAttribute('data-quickshop-popup');
          }
          var text = btn.textContent ? btn.textContent.trim().toLowerCase() : '';
          if (text === 'quick shop' || text === 'select options' || text === 'choose options') {
            btn.textContent = 'Add to cart';
          }
        });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sanitizeBogoCardButtons);
      } else {
        sanitizeBogoCardButtons();
      }
      setInterval(sanitizeBogoCardButtons, 800);

      document.addEventListener('submit', function (event) {
        if (!isBogoCollectionPage()) return;
        var api = offerApi();
        var form = event.target;
        if (!api || !form || !form.action || form.action.indexOf('/cart/add') === -1) return;
        if (form.closest && form.closest('.bogo-offer')) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        var card = productRoot(form);
        var qtyNode = form.querySelector('input[name="quantity"][data-product-card-quantity], input[name="quantity"]');
        api.addFromCard(card, qtyNode ? parseInt(qtyNode.value, 10) || 1 : 1, null, form);
      }, true);
    }

    if (window.Shopify && typeof window.Shopify.addItem === 'function' && !window.Shopify.addItem.__bogoWrapped) {
      var origAddItem = window.Shopify.addItem;
      var wrapped = function (variantId, quantity, $target) {
        if (!isBogoCollectionPage()) {
          return origAddItem.apply(this, arguments);
        }
        var api = offerApi();
        if (!api) return origAddItem.apply(this, arguments);
        var targetEl = $target && $target[0] ? $target[0] : $target;
        var card = targetEl ? productRoot(targetEl) : null;
        var form = targetEl && targetEl.closest ? targetEl.closest('form') : null;
        if (!card) return origAddItem.apply(this, arguments);
        api.addFromCard(card, quantity || 1, variantId, form);
      };
      wrapped.__bogoWrapped = true;
      window.Shopify.addItem = wrapped;
    }

    document.body.classList.add('bogo-offer-active');
    if (config.position === 'top') document.body.classList.add('bogo-offer-at-top');
    if (!window.__bogoResizeBound) {
      window.__bogoResizeBound = true;
      window.addEventListener('resize', function () {
        document.querySelectorAll('[data-bogo-offer]').forEach(function (node) {
          var height = Math.ceil(node.getBoundingClientRect().height);
          document.documentElement.style.setProperty('--bogo-offer-height', height + 'px');
        });
      });
    }
    ensureCatalog();
    render();
  }

  if (typeof document !== 'undefined') {
    var boot = function () {
      document.querySelectorAll('[data-bogo-offer]').forEach(function (node) {
        mount(node);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  return {
    mount: mount,
    remainingCount: remainingCount,
    buildProgressMessage: buildProgressMessage,
    normalizeSlots: normalizeSlots,
    addUnits: addUnits,
    canSubmit: canSubmit,
    buildCartPayload: buildCartPayload,
    priceToCents: priceToCents
  };
});
