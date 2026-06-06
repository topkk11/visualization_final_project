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
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function initApp() {
    showLoading();

    try {
        await DataProcessor.init();
        await FilterModule.init();

        await Promise.all([
            KPIModule.init(),
            SalesTrendModule.init(),
            ProductAnalysisModule.init(),
            GeoSalesModule.init(),
            CustomerRFMModule.init()
        ]);

        EventBus.on('filterChange', async (filters) => {
            showLoading();
            await Promise.all([
                KPIModule.update(filters),
                SalesTrendModule.update(filters),
                ProductAnalysisModule.update(filters),
                GeoSalesModule.update(filters),
                CustomerRFMModule.update(filters)
            ]);
            hideLoading();
        });

        window.addEventListener('resize', () => {
            ['chart-sales-trend', 'chart-product-analysis', 'chart-geo-sales', 'chart-customer-rfm']
                .forEach(id => {
                    const dom = document.getElementById(id);
                    if (dom) {
                        const inst = echarts.getInstanceByDom(dom);
                        if (inst) inst.resize();
                    }
                });
        });

    } catch (err) {
        console.error('Initialization failed:', err);
    }

    hideLoading();
}

document.addEventListener('DOMContentLoaded', initApp);
