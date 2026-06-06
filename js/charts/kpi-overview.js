const KPIModule = (() => {

    async function init() {
        const data = await DataProcessor.getKPIData({});
        render(data);
    }

    async function update(filters) {
        const data = await DataProcessor.getKPIData(filters);
        render(data);
    }

    function render(data) {
        document.getElementById('kpi-sales').textContent =
            '£' + data.totalSales.toLocaleString('en-US', { maximumFractionDigits: 0 });
        document.getElementById('kpi-orders').textContent =
            data.totalOrders.toLocaleString();
        document.getElementById('kpi-aov').textContent =
            '£' + data.avgOrderValue.toFixed(2);
        document.getElementById('kpi-customers').textContent =
            data.totalCustomers.toLocaleString();
    }

    return { init, update };
})();
