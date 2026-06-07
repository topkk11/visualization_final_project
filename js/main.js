window.onerror = function(msg, url, line, col, error) {
    console.error('[GLOBAL ERROR]', msg, 'at', url, 'line', line, 'col', col, error);
    // Show error on page for visibility
    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
        debugEl.textContent += 'ERROR: ' + msg + ' (line ' + line + ')\n';
        debugEl.style.display = 'block';
    }
};

const EventBus = {
    events: {},
    on(event, fn) { (this.events[event] = this.events[event] || []).push(fn); },
    emit(event, data) { (this.events[event] || []).forEach(fn => fn(data)); }
};

function showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = '<div>Loading...</div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    console.log('[DEBUG] showLoading called');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
    console.log('[DEBUG] hideLoading called');
}

let drillState = { country: null, segment: null };

function updateBreadcrumb(filters) {
    const breadcrumb = document.getElementById('drilldown-breadcrumb');
    if (!breadcrumb) return;

    const totalCountries = DataProcessor.getCountries().length;
    const isCountryFiltered = filters.countries && filters.countries.length > 0
        && filters.countries.length < totalCountries;
    const isSegmentFiltered = filters.segmentFilter && filters.segmentFilter.length > 0
        && filters.segmentFilter.length < 4;

    drillState.country = isCountryFiltered ? filters.countries.join(', ') : null;
    drillState.segment = isSegmentFiltered ? filters.segmentFilter.join(' + ') : null;

    let html = '';

    if (!drillState.country && !drillState.segment) {
        html = '<span class="crumb active">All Data</span>';
    } else {
        html = '<span class="crumb" id="crumb-all">All Data</span>';
        if (drillState.segment) {
            html += ` <span class="separator">›</span> <span class="crumb active">${drillState.segment}</span>`;
        }
        if (drillState.country) {
            html += ` <span class="separator">›</span> <span class="crumb active">${drillState.country}</span>`;
        }
    }

    breadcrumb.innerHTML = html;

    // Click "All Data" to reset filters
    const crumbAll = document.getElementById('crumb-all');
    if (crumbAll) {
        crumbAll.addEventListener('click', () => {
            document.getElementById('btn-reset')?.click();
        });
    }
}

async function initApp() {
    showLoading();

    try {
        console.log('[DEBUG] Starting DataProcessor.init()...');
        await DataProcessor.init();
        console.log('[DEBUG] DataProcessor.init() done. Starting FilterModule.init()...');
        await FilterModule.init();
        console.log('[DEBUG] FilterModule.init() done. Starting chart inits...');

        const modules = [
            { name: 'KPI', instance: KPIModule },
            { name: 'SalesTrend', instance: SalesTrendModule },
            { name: 'ProductAnalysis', instance: ProductAnalysisModule },
            { name: 'GeoSales', instance: GeoSalesModule },
            { name: 'RFMScatter', instance: RFMScatterModule },
            { name: 'CountryCustomer', instance: CountryCustomerModule }
        ];

        const initResults = await Promise.allSettled(
            modules.map(m => m.instance.init())
        );
        initResults.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`${modules[i].name} init failed:`, r.reason);
            }
        });

        console.log('[DEBUG] All chart inits completed. Results:', initResults.map(r => r.status));

        EventBus.on('filterChange', async (filters) => {
            showLoading();
            updateBreadcrumb(filters);
            const updateResults = await Promise.allSettled(
                modules.map(m => m.instance.update(filters))
            );
            updateResults.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.error(`${modules[i].name} update failed:`, r.reason);
                }
            });
            hideLoading();
        });

        EventBus.on('customerClick', (customer) => {
            // When a customer point is clicked in the scatter, filter to their country
            if (customer && customer.Country) {
                document.querySelectorAll('#filter-countries .country-cb').forEach(cb => {
                    cb.checked = (cb.value === customer.Country);
                });
                document.getElementById('btn-apply')?.click();
            }
        });

        window.addEventListener('resize', () => {
            ['chart-sales-trend', 'chart-product-analysis', 'chart-geo-sales',
             'chart-rfm-scatter', 'chart-country-customer']
                .forEach(id => {
                    const dom = document.getElementById(id);
                    if (dom) {
                        const inst = echarts.getInstanceByDom(dom);
                        if (inst) inst.resize();
                    }
                });
        });

    } catch (err) {
        console.error('[DEBUG] Initialization failed:', err.message, err.stack);
    }

    console.log('[DEBUG] Calling hideLoading()...');
    hideLoading();
    console.log('[DEBUG] initApp() complete');
}

document.addEventListener('DOMContentLoaded', initApp);
