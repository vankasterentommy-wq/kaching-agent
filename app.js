const STORAGE_KEY = 'kaching_data_v3';

const cogSlider = document.getElementById('cogSlider');
const cogValueEl = document.getElementById('cogValue');
const productList = document.getElementById('productList');
const addProductBtn = document.getElementById('addProduct');

let products = [];

// --- Smart Pricing Engine ---

const PRICE_POINTS = [
    2.99, 4.99, 7.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99,
    34.99, 39.99, 44.99, 49.99, 59.99, 69.99, 79.99, 89.99,
    99.99, 129.99, 149.99, 199.99, 249.99, 299.99
];

function makeAttractive(rawPrice) {
    // Round UP to the nearest attractive price point so COG stays at/below target
    for (const p of PRICE_POINTS) {
        if (p >= rawPrice) return { price: p, display: `$${p.toFixed(2)}` };
    }
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

    // Helper: build deal object from qty and per-unit price
    function makeDeal(qty, perUnit) {
        const totalPrice = parseFloat((perUnit * qty).toFixed(2));
        const original = parseFloat((wasSingle * qty).toFixed(2));
        const savePct = Math.round((1 - totalPrice / original) * 100);
        const discountVsSingle = Math.round((1 - perUnit / sp) * 100);
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

    // B2G1F is always best value = pay for 2, get 3 (33.3% off per unit)
    const b2g1fPerUnit = parseFloat(((sp * 2) / 3).toFixed(2));

    // All other deals must have LESS discount per unit than B2G1F
    // Hierarchy (low to high discount): v1 < v2 < v3 < v4 < v5 < v6(B2G1F)

    // --- 1: Single Set ---
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

    // --- 2: Buy 2 - Get $X Off (fixed dollar discount, ~10% off) ---
    const dollarOff2 = Math.round(sp * 0.10);
    const buy2total = parseFloat((sp * 2 - dollarOff2).toFixed(2));
    const buy2perUnit = buy2total / 2;
    const d2 = makeDeal(2, buy2perUnit);
    const v2 = {
        label: `Buy 2 - Get $${dollarOff2} Off`,
        subtitle: `$${buy2perUnit.toFixed(2)} each`,
        badge: `$${dollarOff2} OFF`,
        badgeColor: 'yellow',
        ...d2,
    };

    // --- 3: Buy 2 & Save 15% ---
    const buy2save15perUnit = parseFloat((sp * 0.85).toFixed(2));
    const d3 = makeDeal(2, buy2save15perUnit);
    const v3 = {
        label: 'Buy 2 & Save 15%',
        subtitle: `${d3.discountVsSingle}% off per item`,
        badge: '15% OFF',
        badgeColor: 'yellow',
        ...d3,
    };

    // --- 4: Buy 1 Get 1 50% Off (25% off per unit) ---
    const bogo50perUnit = parseFloat((sp * 0.75).toFixed(2));
    const d4 = makeDeal(2, bogo50perUnit);
    const v4 = {
        label: 'Buy 1 Get 1 50% Off',
        subtitle: 'Add a second set mix & match',
        badge: '50% OFF 2ND',
        badgeColor: 'orange',
        ...d4,
    };

    // --- 5: Buy 3 - Get $X Off (bigger dollar discount, ~28% off) ---
    const dollarOff3 = Math.round(sp);
    const buy3total = parseFloat((sp * 3 - dollarOff3).toFixed(2));
    const buy3perUnit = buy3total / 3;
    const d5 = makeDeal(3, buy3perUnit);
    const v5 = {
        label: `Buy 3 - Get $${dollarOff3} Off`,
        subtitle: `Save $${dollarOff3} on 3 items`,
        badge: `$${dollarOff3} OFF`,
        badgeColor: 'orange',
        ...d5,
    };

    // --- 6: Buy 2 Get 1 FREE (33% off per unit) ---
    const d6 = makeDeal(3, b2g1fPerUnit);
    const v6 = {
        label: 'Buy 2 Get 1 FREE',
        subtitle: 'Pay for 2, get 3',
        badge: 'FREE ITEM',
        badgeColor: 'orange',
        ...d6,
    };

    const variations = [v1, v2, v3, v4, v5, v6];

    // Auto-mark the deal with highest discount (highest COG%) as best deal for customer
    let bestIdx = -1;
    let highestCog = 0;
    variations.forEach((v, i) => {
        if (i === 0) return;
        const cogVal = parseFloat(v.cog);
        if (cogVal > highestCog) {
            highestCog = cogVal;
            bestIdx = i;
        }
    });
    if (bestIdx >= 0) variations[bestIdx].isBestDeal = true;

    return variations;
}

// --- Rendering ---

function badgeClass(color) {
    const map = { orange: 'badge-orange', yellow: 'badge-yellow', green: 'badge-best', red: 'badge-red' };
    return map[color] || 'badge-single';
}

function renderVariation(v) {
    return `
        <div class="price-option ${v.isBestDeal ? 'best-deal' : ''}">
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
