const DataProcessor = (() => {
    let raw = null;

    async function init() {
        raw = await DataLoader.loadData();
    }

    // countries filter helpers: null=no filter, []=empty, [...values]=partial
    function isCountryFilterActive(countries) {
        return Array.isArray(countries) && countries.length !== raw.countries.length;
    }
    function isCountryFilterEmpty(countries) {
        return Array.isArray(countries) && countries.length === 0;
    }
    function filterByCountry(data, countries, key) {
        if (isCountryFilterEmpty(countries)) return [];
        if (isCountryFilterActive(countries)) return data.filter(d => countries.includes(d[key || 'Country']));
        return data; // null or all-countries → no filter
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
        if (isCountryFilterActive(countries)) {
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
        if (isCountryFilterEmpty(countries)) {
            return { totalSales: 0, totalOrders: 0, avgOrderValue: 0, totalCustomers: 0 };
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
        const { dateFrom, dateTo, countries } = filters;
        const keyMap = { day: 'salesByDay', week: 'salesByWeek', month: 'salesByMonth' };
        const countryKeyMap = { day: 'countrySalesByDay', week: 'countrySalesByWeek', month: 'countrySalesByMonth' };
        const fieldMap = { day: 'DateStr', week: 'YearWeek', month: 'YearMonth' };

        // If country filter is active, use country-level time data
        if (isCountryFilterActive(countries)) {
            let data = raw[countryKeyMap[granularity]] || raw.countrySalesByMonth || [];
            data = data.filter(d => countries.includes(d.Country));
            // Aggregate across selected countries per time period
            const aggregated = {};
            data.forEach(d => {
                const key = d[fieldMap[granularity]] || d.YearMonth;
                if (!aggregated[key]) aggregated[key] = { sales: 0, orders: 0 };
                aggregated[key].sales += d.sales;
                aggregated[key].orders += d.orders;
            });
            let result = Object.entries(aggregated).map(([time, vals]) => ({
                [fieldMap[granularity]]: time,
                sales: vals.sales,
                orders: vals.orders
            }));
            result.sort((a, b) => String(a[fieldMap[granularity]]).localeCompare(String(b[fieldMap[granularity]])));
            return filterByDate(result, fieldMap[granularity], dateFrom, dateTo);
        }

        const data = raw[keyMap[granularity]] || raw.salesByMonth;
        return filterByDate(data, fieldMap[granularity], dateFrom, dateTo);
    }

    function getSalesByCountry(filters = {}) {
        const { countries, segmentFilter } = filters;
        let data = filterByCountry(raw.salesByCountry, countries);
        // If segment filter is active, attach segment customer counts for geo map
        if (segmentFilter && segmentFilter.length > 0 && segmentFilter.length < 4) {
            const filteredRFM = getRFMData(filters);
            const segCountByCountry = {};
            filteredRFM.forEach(d => {
                segCountByCountry[d.Country] = (segCountByCountry[d.Country] || 0) + 1;
            });
            data = data.map(d => ({
                ...d,
                segmentCustomerCount: segCountByCountry[d.Country] || 0
            }));
        }
        return data;
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

    function getRFMData(filters = {}) {
        const { countries, segmentFilter } = filters;
        let data = filterByCountry(raw.rfm, countries);
        if (segmentFilter && segmentFilter.length > 0 && segmentFilter.length < 4) {
            data = data.filter(d => segmentFilter.includes(d.segment));
        }
        return data;
    }

    function getCountryCustomerStats(filters = {}) {
        return filterByCountry(raw.countryCustomer, filters.countries);
    }

    // Compute per-country + per-segment average metrics on-the-fly from RFM data
    function getCountrySegmentStats(filters = {}, segment) {
        const rfmData = getRFMData(filters);
        // Filter to specific segment
        const segData = rfmData.filter(d => d.segment === segment);
        // Group by country
        const countryMap = {};
        segData.forEach(d => {
            const c = d.Country;
            if (!countryMap[c]) {
                countryMap[c] = { total_freq: 0, total_mon: 0, count: 0 };
            }
            countryMap[c].total_freq += d.frequency;
            countryMap[c].total_mon += d.monetary;
            countryMap[c].count += 1;
        });
        return Object.entries(countryMap).map(([Country, v]) => ({
            Country,
            avg_frequency: +(v.total_freq / v.count).toFixed(1),
            avg_monetary: Math.round(v.total_mon / v.count),
            count: v.count
        }));
    }

    function getSegmentDistribution(filters = {}) {
        const rfmData = getRFMData(filters);
        const segments = ['VIP', 'Regular', 'Low Value', 'At Risk'];
        return segments.map(seg => ({
            name: seg,
            value: rfmData.filter(d => d.segment === seg).length
        }));
    }

    function getCountryNameMap() {
        return raw.countryNameMap;
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
        getCountryCustomerStats,
        getCountrySegmentStats,
        getSegmentDistribution,
        getCountryNameMap,
        getDateRange,
        getCountries
    };
})();
