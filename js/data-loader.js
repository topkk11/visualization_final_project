const DataLoader = (() => {
    let cachedData = null;

    async function loadData() {
        if (cachedData) return cachedData;
        const resp = await fetch('data/retail_data.json');
        if (!resp.ok) throw new Error(`Failed to load data: ${resp.status}`);
        cachedData = await resp.json();
        return cachedData;
    }

    return { loadData };
})();
