const DataProcessor = (() => {
    let raw = null;

    async function init() {
        raw = await DataLoader.loadData();
    }

    function filterByDate(arr, dateField, dateFrom, dateTo) {
        if (!dateFrom && !dateTo) return arr;
        return arr.filter(d => {
            const dStr = d[dateField];
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
        });
    }

    function getKPIData(filters = {}) {
        const { dateFrom, dateTo, countries } = filters;
        if (countries && countries.length > 0) {
            const countryData = raw.salesByCountry.filter(c => countries.includes(c.Country));
            const totalSales = countryData.reduce((s, c) => s + c.sales, 0);
            const totalOrders = countryData.reduce((s, c) => s + c.orders, 0);
            const totalCustomers = countryData.reduce((s, c) => s + c.customers, 0);
            return {
                totalSales,
                totalOrders,
                avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
                totalCustomers
            };
        }
        let data = filterByDate(raw.salesByDay, 'DateStr', dateFrom, dateTo);
        const totalSales = data.reduce((s, d) => s + d.sales, 0);
        const totalOrders = data.reduce((s, d) => s + d.orders, 0);
        return {
            totalSales,
            totalOrders,
            avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
            totalCustomers: raw.kpi.totalCustomers
        };
    }

    function getSalesByTime(filters = {}, granularity = 'month') {
        const { dateFrom, dateTo } = filters;
        const keyMap = { day: 'salesByDay', week: 'salesByWeek', month: 'salesByMonth' };
        const fieldMap = { day: 'DateStr', week: 'YearWeek', month: 'YearMonth' };
        const data = raw[keyMap[granularity]] || raw.salesByMonth;
        return filterByDate(data, fieldMap[granularity], dateFrom, dateTo);
    }

    function getSalesByCountry(filters = {}) {
        const { countries } = filters;
        if (countries && countries.length > 0) {
            return raw.salesByCountry.filter(c => countries.includes(c.Country));
        }
        return raw.salesByCountry;
    }

    function getTopProducts(filters = {}, topN = 20, sortBy = 'sales') {
        const { productSearch } = filters;
        let data = raw.topProducts;
        if (productSearch) {
            const kw = productSearch.toLowerCase();
            data = data.filter(p => p.Description.toLowerCase().includes(kw));
        }
        data = [...data].sort((a, b) => b[sortBy] - a[sortBy]);
        return data.slice(0, topN);
    }

    function getRFMData() {
        return raw.rfm;
    }

    function getDateRange() {
        return raw.dateRange;
    }

    function getCountries() {
        return raw.countries;
    }

    return {
        init,
        getKPIData,
        getSalesByTime,
        getSalesByCountry,
        getTopProducts,
        getRFMData,
        getDateRange,
        getCountries
    };
})();
