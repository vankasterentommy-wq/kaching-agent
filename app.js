const STORAGE_KEY = 'kaching_data_v3';

const cogSlider = document.getElementById('cogSlider');
const cogValueEl = document.getElementById('cogValue');
const productList = document.getElementById('productList');
const addProductBtn = document.getElementById('addProduct');

let products = [];

// --- Smart Pricing Engine ---

function makeAttractive(rawPrice) {
    if (rawPrice <= 3) return { price: 2.99, display: '$2.99' };
    if (rawPrice <= 5) return { price: 4.99, display: '$4.99' };
    if (rawPrice <= 8) return { price: 7.99, display: '$7.99' };
    if (rawPrice <= 11) return { price: 9.99, display: '$9.99' };
    if (rawPrice <= 15) return { price: 12.99, display: '$12.99' };
    if (rawPrice <= 18) return { price: 14.99, display: '$14.99' };
    if (rawPrice <= 22) return { price: 19.99, display: '$19.99' };
    if (rawPrice <= 28) return { price: 24.99, display: '$24.99' };
    if (rawPrice <= 35) return { price: 29.99, display: '$29.99' };
    if (rawPrice <= 42) return { price: 34.99, display: '$34.99' };
    if (rawPrice <= 48) return { price: 39.99, display: '$39.99' };
    if (rawPrice <= 55) return { price: 44.99, display: '$44.99' };
    if (rawPrice <= 65) return { price: 49.99, display: '$49.99' };
    if (rawPrice <= 75) return { price: 59.99, display: '$59.99' };
    if (rawPrice <= 85) return { price: 69.99, display: '$69.99' };
    if (rawPrice <= 95) return { price: 79.99, display: '$79.99' };
    if (rawPrice <= 110) return { price: 89.99, display: '$89.99' };
    if (rawPrice <= 130) return { price: 99.99, display: '$99.99' };
    if (rawPrice <= 160) return { price: 129.99, display: '$129.99' };
    if (rawPrice <= 200) return { price: 149.99, display: '$149.99' };
    const rounded = Math.ceil(rawPrice / 10) * 10 - 0.01;
    return { price: rounded, display: `$${rounded.toFixed(2)}` };
}

function generatePricing(costPrice, cogPct) {
    if (!costPrice || costPrice <= 0 || cogPct <= 0) return null;

    // Base price: cost price / COG% = selling price per unit
    const rawSingle = costPrice / (cogPct / 100);
    const single = makeAttractive(rawSingle);
    const sp = single.price; // single price = base for everything

    // Compare-at price per unit (anchor ~2x)
    const anchor = makeAttractive(sp * 2);
    const wasPrice = Math.max(anchor.price, sp * 1.8);
    const wasSingle = makeAttractive(wasPrice).price;

    // Fixed discount percentages per unit vs single price
    // Hierarchy: each deal MUST be cheaper per unit than the previous
    const discounts = {
        bogo50: 0.25,     // 25% off each (2 items)
        buy2save: 0.15,   // 15% off each (2 items)
        b2g1free: 0.333,  // 33% off each (3 items, pay for 2)
        best3: 0.30,      // 30% off each (3 items)
        mega5: 0.40,      // 40% off each (5 items)
    };

    function makeDeal(qty, discountPct) {
        const perUnit = sp * (1 - discountPct);
        const totalPrice = parseFloat((perUnit * qty).toFixed(2));
        const original = parseFloat((wasSingle * qty).toFixed(2));
        const savePct = Math.round((1 - totalPrice / original) * 100);
        const discountVsSingle = Math.round(discountPct * 100);
        return {
            price: totalPrice,
            display: `$${totalPrice.toFixed(2)}`,
            original: `$${original.toFixed(2)}`,
            savePct: savePct > 0 ? savePct : null,
            perUnit: `$${perUnit.toFixed(2)} each`,
            discountVsSingle,
            cog: (costPrice / perUnit * 100).toFixed(0),
            totalProfit: ((perUnit - costPrice) * qty).toFixed(2),
        };
    }

    // --- Variation 1: Single Set ---
    const singleSave = Math.round((1 - sp / wasSingle) * 100);
    const v1 = {
        label: 'Single Set',
        subtitle: null,
        badge: null,
        badgeColor: null,
        price: sp,
        display: single.display,
        original: `$${wasSingle.toFixed(2)}`,
        savePct: singleSave > 0 ? singleSave : null,
        perUnit: null,
        cog: (costPrice / sp * 100).toFixed(0),
        totalProfit: (sp - costPrice).toFixed(2),
    };

    // --- Variation 2: Buy 2 & Save (15% off each) ---
    const d2 = makeDeal(2, discounts.buy2save);
    const v2 = {
        label: 'Buy 2 & Save',
        subtitle: `${d2.discountVsSingle}% off per item`,
        badge: `$${(sp * 2 - d2.price).toFixed(0)} OFF`,
        badgeColor: 'yellow',
        ...d2,
    };

    // --- Variation 3: Buy 1 Get 1 50% Off (25% off each) ---
    const d3 = makeDeal(2, discounts.bogo50);
    const v3 = {
        label: 'Buy 1 Get 1 50% Off',
        subtitle: 'Add a second set mix & match',
        badge: '50% OFF',
        badgeColor: 'orange',
        ...d3,
    };

    // --- Variation 4: Best Value 3-Pack (30% off each) ---
    const d4 = makeDeal(3, discounts.best3);
    const v4 = {
        label: 'Best Value - 3 Pack',
        subtitle: 'Most popular choice',
        badge: `${d4.discountVsSingle}% OFF`,
        badgeColor: 'yellow',
        ...d4,
    };

    // --- Variation 5: Buy 2 Get 1 Free (33% off each) ---
    const d5 = makeDeal(3, discounts.b2g1free);
    const v5 = {
        label: 'Buy 2 Get 1 FREE',
        subtitle: '3 items for the price of 2',
        badge: 'FREE ITEM',
        badgeColor: 'green',
        ...d5,
    };

    // --- Variation 6: Mega Pack 5 items (40% off each) ---
    const d6 = makeDeal(5, discounts.mega5);
    const v6 = {
        label: 'Mega Pack - 5 items',
        subtitle: 'Biggest savings',
        badge: `${d6.discountVsSingle}% OFF`,
        badgeColor: 'red',
        ...d6,
    };

    return [v1, v2, v3, v4, v5, v6];
}

// --- Rendering ---

function badgeClass(color) {
    const map = { orange: 'badge-orange', yellow: 'badge-yellow', green: 'badge-best', red: 'badge-red' };
    return map[color] || 'badge-single';
}

function renderVariation(v) {
    return `
        <div class="price-option ${v.badgeColor === 'green' ? 'best-deal' : ''}">
            <div class="price-option-header">
                <span class="price-label-title">${v.label}</span>
                ${v.badge ? `<span class="price-badge ${badgeClass(v.badgeColor)}">${v.badge}</span>` : ''}
            </div>
            ${v.subtitle ? `<div class="price-subtitle">${v.subtitle}</div>` : ''}
            <div class="price-main">${v.display}<span class="price-original">${v.original}</span></div>
            ${v.perUnit ? `<div class="price-per-unit">${v.perUnit}</div>` : ''}
            ${v.savePct ? `<span class="price-save">SAVE ${v.savePct}%</span>` : ''}
            <div class="price-meta">
                <span class="meta-item">COG: <strong>${v.cog}%</strong></span>
                <span class="meta-item">Profit: <strong>$${v.totalProfit}</strong></span>
            </div>
        </div>`;
}

function renderAll() {
    productList.innerHTML = '';

    if (products.length === 0) {
        productList.innerHTML = '<div class="empty-state">Add a product to get started</div>';
        return;
    }

    const cog = parseFloat(cogSlider.value);

    products.forEach((product, index) => {
        const variations = generatePricing(product.costPrice, cog);
        const card = document.createElement('div');
        card.className = 'product-card';

        let pricingHtml = '';
        if (variations) {
            pricingHtml = `<div class="pricing-grid">${variations.map(renderVariation).join('')}</div>`;
        } else {
            pricingHtml = '<div class="placeholder-msg" style="padding: 2rem; text-align: center; color: var(--text-muted);">Enter a cost price</div>';
        }

        card.innerHTML = `
            <div class="product-top">
                <input type="text" placeholder="Product name..." value="${escHtml(product.name)}" data-index="${index}" data-field="name">
                <div class="cost-input-group">
                    <div class="cost-input-label">CJ price incl. shipping</div>
                    <div class="cost-input-wrapper">
                        <span>$</span>
                        <input type="number" placeholder="0.00" step="0.01" min="0" value="${product.costPrice || ''}" data-index="${index}" data-field="costPrice">
                    </div>
                </div>
                <button class="btn btn-icon" data-delete="${index}">&times;</button>
            </div>
            ${pricingHtml}
        `;

        card.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                if (field === 'name') {
                    products[idx].name = e.target.value;
                } else {
                    products[idx].costPrice = parseFloat(e.target.value) || 0;
                }
                // Update pricing inline
                const cogVal = parseFloat(cogSlider.value);
                const newVariations = generatePricing(products[idx].costPrice, cogVal);
                const grid = card.querySelector('.pricing-grid');
                if (newVariations && grid) {
                    grid.innerHTML = newVariations.map(renderVariation).join('');
                } else if (newVariations && !grid) {
                    renderAll();
                    return;
                }
                save();
            });
        });

        card.querySelector('[data-delete]').addEventListener('click', () => {
            products.splice(index, 1);
            renderAll();
            save();
        });

        productList.appendChild(card);
    });
}

// --- Init & Events ---

function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            products = data.products || [];
            cogSlider.value = data.cogMultiplier || 30;
        } catch (e) {
            products = [];
        }
    }

    if (products.length === 0) {
        products.push({ id: Date.now(), name: '', costPrice: 0 });
    }

    updateCogDisplay();
    renderAll();
}

function updateCogDisplay() {
    cogValueEl.textContent = `${Math.round(parseFloat(cogSlider.value))}%`;
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cogMultiplier: parseFloat(cogSlider.value),
        products,
    }));
}

cogSlider.addEventListener('input', () => {
    updateCogDisplay();
    renderAll();
    save();
});

addProductBtn.addEventListener('click', () => {
    products.push({ id: Date.now(), name: '', costPrice: 0 });
    renderAll();
    save();
    const cards = productList.querySelectorAll('.product-card');
    const last = cards[cards.length - 1];
    if (last) last.querySelector('input[type="text"]').focus();
});

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

init();
