# 交互式可视化系统 — 构建步骤指南

## 项目概述

基于 **Online Retail II** 数据集（UK在线零售交易数据，约107万行），使用 **ECharts + 纯前端技术栈** 构建交互式可视化分析系统，GitHub 协作开发，Netlify 部署上线。

---

## 第1步：环境准备

1. 安装 [Git](https://git-scm.com/) 并注册 [GitHub](https://github.com/) 账号
2. 注册 [Netlify](https://www.netlify.com/) 账号（可用 GitHub 账号直接登录）
3. 安装 Python 3.x，安装依赖：
   ```bash
   pip install pandas openpyxl
   ```

---

## 第2步：创建 GitHub 仓库

1. 由组长在 GitHub 创建仓库（如 `online-retail-viz`，设为 **Private** 可避免被查重）
2. 在 Settings → Collaborators 中添加另外两名成员
3. 三人各自 clone 到本地：
   ```bash
   git clone https://github.com/<username>/online-retail-viz.git
   cd online-retail-viz
   ```

---

## 第3步：创建项目文件结构

在仓库根目录创建以下文件：

```
online-retail-viz/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── data-loader.js
│   ├── data-processor.js
│   ├── charts/
│   │   ├── kpi-overview.js
│   │   ├── sales-trend.js
│   │   ├── product-analysis.js
│   │   ├── geo-sales.js
│   │   └── customer-rfm.js
│   ├── filters.js
│   └── main.js
├── data/
│   └── .gitkeep
└── preprocess.py
```

---

## 第4步：数据预处理（preprocess.py）

用 Python 读取原始 Excel，清洗并聚合导出为前端 JSON。

### 4.1 读取与合并

```python
import pandas as pd
import json
import datetime

df1 = pd.read_excel('online_retail_II(1).xlsx', sheet_name='Year 2009-2010')
df2 = pd.read_excel('online_retail_II(1).xlsx', sheet_name='Year 2010-2011')
df = pd.concat([df1, df2], ignore_index=True)
print(f'Total rows: {len(df)}')
```

### 4.2 数据清洗

```python
# 计算每行总金额
df['TotalAmount'] = df['Quantity'] * df['Price']

# 标记退货（负数量）
df['IsReturn'] = df['Quantity'] < 0

# 分离正常交易
df_valid = df[df['Quantity'] > 0].copy()

# 处理缺失值
df_valid['Customer ID'] = df_valid['Customer ID'].fillna(-1).astype(int)
df_valid['Description'] = df_valid['Description'].fillna('Unknown')

# 解析日期，生成衍生时间字段
df_valid['InvoiceDate'] = pd.to_datetime(df_valid['InvoiceDate'])
df_valid['YearMonth'] = df_valid['InvoiceDate'].dt.to_period('M').astype(str)
df_valid['YearWeek'] = df_valid['InvoiceDate'].dt.to_period('W').astype(str)
df_valid['DateStr'] = df_valid['InvoiceDate'].dt.date.astype(str)

# 商品大类（按 StockCode 首字母或第一个数字分类）
def get_category(code):
    code = str(code).strip().upper()
    if code[0].isdigit():
        return 'Numeric'
    return code[0]

df_valid['Category'] = df_valid['StockCode'].apply(get_category)
```

### 4.3 计算聚合数据

```python
# KPI 汇总
kpi = {
    'totalSales': round(float(df_valid['TotalAmount'].sum()), 2),
    'totalOrders': int(df_valid['Invoice'].nunique()),
    'totalCustomers': int(df_valid[df_valid['Customer ID'] != -1]['Customer ID'].nunique()),
    'totalQuantity': int(df_valid['Quantity'].sum()),
    'avgOrderValue': round(float(df_valid['TotalAmount'].sum() / df_valid['Invoice'].nunique()), 2)
}

# 按月销售趋势
sales_by_month = df_valid.groupby('YearMonth').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('Customer ID', 'nunique')
).reset_index().to_dict('records')

# 按周销售趋势
sales_by_week = df_valid.groupby('YearWeek').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

# 按日销售趋势
sales_by_day = df_valid.groupby('DateStr').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

# 按国家统计
sales_by_country = df_valid.groupby('Country').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('Customer ID', 'nunique'),
    avgPrice=('Price', 'mean')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# Top 100 热销商品（按销售额排名）
top_products = df_valid.groupby(['StockCode', 'Description']).agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().sort_values('sales', ascending=False).head(100).to_dict('records')

# 商品大类统计
categories = df_valid.groupby('Category').agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# 退货统计（按月）
returns = df[df['IsReturn'] == True].copy()
returns['YearMonth'] = returns['InvoiceDate'].dt.to_period('M').astype(str)
returns_by_month = returns.groupby('YearMonth').agg(
    returnCount=('Invoice', 'count'),
    returnAmount=('TotalAmount', 'sum')
).reset_index().to_dict('records')
```

### 4.4 RFM 客户分层

```python
ref_date = df_valid['InvoiceDate'].max() + datetime.timedelta(days=1)

rfm = df_valid.groupby('Customer ID').agg(
    recency=('InvoiceDate', lambda x: (ref_date - x.max()).days),
    frequency=('Invoice', 'nunique'),
    monetary=('TotalAmount', 'sum')
).reset_index()

# 排除 Customer ID = -1（原缺失值）
rfm = rfm[rfm['Customer ID'] != -1]

# 分位数打分
rfm['R_score'] = pd.qcut(rfm['recency'], 3, labels=['high', 'mid', 'low'])
rfm['F_score'] = pd.qcut(rfm['frequency'], 3, labels=['low', 'mid', 'high'])
rfm['M_score'] = pd.qcut(rfm['monetary'], 3, labels=['low', 'mid', 'high'])

def classify(row):
    if row['R_score'] == 'high' and row['F_score'] == 'high' and row['M_score'] == 'high':
        return 'VIP'
    elif row['R_score'] == 'low':
        return 'At Risk'
    elif row['F_score'] == 'low' and row['M_score'] == 'low':
        return 'Low Value'
    else:
        return 'Regular'

rfm['segment'] = rfm.apply(classify, axis=1)
rfm_data = rfm[['Customer ID', 'recency', 'frequency', 'monetary', 'segment']].to_dict('records')
```

### 4.5 导出 JSON

```python
output = {
    'kpi': kpi,
    'salesByMonth': sales_by_month,
    'salesByWeek': sales_by_week,
    'salesByDay': sales_by_day,
    'salesByCountry': sales_by_country,
    'topProducts': top_products,
    'categories': categories,
    'returnsByMonth': returns_by_month,
    'rfm': rfm_data,
    'dateRange': {
        'min': df_valid['DateStr'].min(),
        'max': df_valid['DateStr'].max()
    },
    'countries': sorted(df_valid['Country'].unique().tolist())
}

with open('data/retail_data.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, default=str)

print(f'JSON exported. Size: {len(json.dumps(output, ensure_ascii=False, default=str))} bytes')
```

运行：
```bash
python preprocess.py
```

`data/retail_data.json` 尽量控制在 **2-5MB**。

---

## 第5步：页面骨架（index.html + style.css）

### 5.1 index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Online Retail — Interactive Visualization</title>
    <link rel="stylesheet" href="css/style.css">
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
</head>
<body>
    <header>
        <h1>UK Online Retail Sales Dashboard</h1>
        <div class="kpi-row" id="kpi-container">
            <div class="kpi-card"><h3>Total Sales</h3><p id="kpi-sales">-</p></div>
            <div class="kpi-card"><h3>Total Orders</h3><p id="kpi-orders">-</p></div>
            <div class="kpi-card"><h3>Avg Order Value</h3><p id="kpi-aov">-</p></div>
            <div class="kpi-card"><h3>Active Customers</h3><p id="kpi-customers">-</p></div>
        </div>
    </header>

    <div id="app">
        <aside id="filter-panel">
            <h3>Filters</h3>
            <div class="filter-group">
                <label>Date From</label>
                <input type="date" id="filter-date-from">
            </div>
            <div class="filter-group">
                <label>Date To</label>
                <input type="date" id="filter-date-to">
            </div>
            <div class="filter-group">
                <label>Countries</label>
                <div id="filter-countries"></div>
            </div>
            <div class="filter-group">
                <label>Product Search</label>
                <input type="text" id="filter-product" placeholder="Search product...">
            </div>
            <div class="filter-actions">
                <button id="btn-apply">Apply</button>
                <button id="btn-reset">Reset</button>
            </div>
            <div class="granularity-group">
                <label>Time Granularity</label>
                <button class="granularity-btn active" data-gran="day">Day</button>
                <button class="granularity-btn" data-gran="week">Week</button>
                <button class="granularity-btn" data-gran="month">Month</button>
            </div>
        </aside>

        <main id="charts-area">
            <div class="chart-row">
                <div id="chart-sales-trend" class="chart-box chart-large"></div>
                <div id="chart-geo-sales" class="chart-box chart-medium"></div>
            </div>
            <div class="chart-row">
                <div id="chart-product-analysis" class="chart-box chart-medium"></div>
                <div id="chart-customer-rfm" class="chart-box chart-medium"></div>
            </div>
        </main>
    </div>

    <script src="js/data-loader.js"></script>
    <script src="js/data-processor.js"></script>
    <script src="js/charts/kpi-overview.js"></script>
    <script src="js/charts/sales-trend.js"></script>
    <script src="js/charts/product-analysis.js"></script>
    <script src="js/charts/geo-sales.js"></script>
    <script src="js/charts/customer-rfm.js"></script>
    <script src="js/filters.js"></script>
    <script src="js/main.js"></script>
</body>
</html>
```

### 5.2 css/style.css

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #f0f2f5;
    color: #333;
}

/* ===== Header & KPI ===== */
header {
    background: #fff;
    padding: 16px 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
header h1 {
    font-size: 22px;
    margin-bottom: 12px;
    color: #1a1a2e;
}
.kpi-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}
.kpi-card {
    flex: 1;
    min-width: 160px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    padding: 14px 18px;
    border-radius: 10px;
    text-align: center;
}
.kpi-card:nth-child(2) { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.kpi-card:nth-child(3) { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.kpi-card:nth-child(4) { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
.kpi-card h3 { font-size: 12px; font-weight: 500; opacity: 0.85; margin-bottom: 4px; }
.kpi-card p { font-size: 26px; font-weight: 700; }

/* ===== Layout ===== */
#app {
    display: flex;
    min-height: calc(100vh - 120px);
}

/* ===== Filter Panel ===== */
#filter-panel {
    width: 260px;
    min-width: 260px;
    background: #fff;
    padding: 20px;
    box-shadow: 2px 0 8px rgba(0,0,0,0.04);
    overflow-y: auto;
}
#filter-panel h3 {
    font-size: 16px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #667eea;
}
.filter-group {
    margin-bottom: 16px;
}
.filter-group > label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #666;
    margin-bottom: 4px;
    text-transform: uppercase;
}
.filter-group input[type="date"],
.filter-group input[type="text"] {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
}
.filter-group input[type="text"]:focus,
.filter-group input[type="date"]:focus {
    outline: none;
    border-color: #667eea;
}
#filter-countries {
    max-height: 200px;
    overflow-y: auto;
    font-size: 12px;
}
#filter-countries label {
    display: block;
    font-weight: 400;
    text-transform: none;
    padding: 2px 0;
    cursor: pointer;
}
.filter-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}
.filter-actions button {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
}
#btn-apply {
    background: #667eea;
    color: #fff;
}
#btn-reset {
    background: #eee;
    color: #666;
}
#btn-apply:hover { background: #5a6fd6; }
#btn-reset:hover { background: #ddd; }

.granularity-group {
    padding-top: 12px;
    border-top: 1px solid #eee;
}
.granularity-btn {
    padding: 4px 12px;
    margin: 4px 4px 0 0;
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 14px;
    font-size: 12px;
    cursor: pointer;
}
.granularity-btn.active {
    background: #667eea;
    color: #fff;
    border-color: #667eea;
}

/* ===== Chart Area ===== */
#charts-area {
    flex: 1;
    padding: 16px;
    min-width: 0;
}
.chart-row {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
}
.chart-box {
    background: #fff;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    min-height: 380px;
}
.chart-large {
    flex: 2;
}
.chart-medium {
    flex: 1;
}

/* ===== Loading Overlay ===== */
#loading-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255,255,255,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    font-size: 18px;
    color: #667eea;
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
    #app { flex-direction: column; }
    #filter-panel { width: 100%; min-width: auto; }
    .chart-row { flex-direction: column; }
}
```

---

## 第6步：数据加载层（data-loader.js + data-processor.js）

### 6.1 js/data-loader.js

```js
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
```

### 6.2 js/data-processor.js

```js
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
```

---

## 第7步：KPI 概览卡片（charts/kpi-overview.js）

```js
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
```

---

## 第8步：销售趋势图（charts/sales-trend.js）

```js
const SalesTrendModule = (() => {
    let chart;
    let currentFilters = {};
    let granularity = 'month';

    async function init() {
        chart = echarts.init(document.getElementById('chart-sales-trend'));

        document.querySelectorAll('.granularity-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.granularity-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                granularity = e.target.dataset.gran;
                await update(currentFilters);
            });
        });

        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getSalesByTime(filters, granularity);

        const option = {
            title: { text: 'Sales Trend', left: 'center', textStyle: { fontSize: 15 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', crossStyle: { color: '#999' } }
            },
            legend: { data: ['Sales (£)', 'Orders'], bottom: 0 },
            grid: { left: '8%', right: '8%', top: '12%', bottom: '12%' },
            dataZoom: [
                { type: 'slider', start: 0, end: 100, height: 20, bottom: 26 },
                { type: 'inside' }
            ],
            xAxis: {
                type: 'category',
                data: data.map(d => d.DateStr || d.YearWeek || d.YearMonth),
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: [
                {
                    type: 'value', name: 'Sales (£)',
                    axisLabel: { formatter: v => (v / 1000).toFixed(0) + 'k' }
                },
                { type: 'value', name: 'Orders' }
            ],
            series: [
                {
                    name: 'Sales (£)', type: 'line', data: data.map(d => d.sales),
                    smooth: true,
                    areaStyle: { color: 'rgba(102, 126, 234, 0.15)' },
                    lineStyle: { color: '#667eea', width: 2 },
                    itemStyle: { color: '#667eea' }
                },
                {
                    name: 'Orders', type: 'bar', yAxisIndex: 1,
                    data: data.map(d => d.orders),
                    barMaxWidth: 18,
                    itemStyle: { color: 'rgba(240, 147, 251, 0.7)' }
                }
            ]
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
```

---

## 第9步：商品分析图（charts/product-analysis.js）

```js
const ProductAnalysisModule = (() => {
    let chart;
    let currentFilters = {};
    let sortBy = 'sales';

    async function init() {
        chart = echarts.init(document.getElementById('chart-product-analysis'));
        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getTopProducts(filters, 15, sortBy);

        const names = data.map(d => d.Description).reverse();
        const values = data.map(d => d[sortBy]).reverse();

        const option = {
            title: { text: 'Top 15 Products', left: 'center', textStyle: { fontSize: 15 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: params => {
                    const p = params[0];
                    const val = sortBy === 'sales'
                        ? '£' + p.value.toLocaleString()
                        : p.value.toLocaleString();
                    return `${p.name}<br/>${val}`;
                }
            },
            grid: { left: '3%', right: '8%', top: '12%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'value',
                axisLabel: {
                    formatter: v => sortBy === 'sales' ? '£' + (v / 1000).toFixed(0) + 'k' : v
                }
            },
            yAxis: {
                type: 'category', data: names, inverse: true,
                axisLabel: { width: 130, overflow: 'truncate', fontSize: 10 }
            },
            series: [{
                type: 'bar', data: values,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#4facfe' },
                        { offset: 1, color: '#00f2fe' }
                    ]),
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
```

---

## 第10步：地理销售分布图（charts/geo-sales.js）

从 [world.json](https://raw.githubusercontent.com/apache/echarts/master/test/data/map/json/world.json) 下载到 `data/world.json`。

```js
const GeoSalesModule = (() => {
    let chart;
    let currentFilters = {};

    const COUNTRY_NAME_MAP = {
        'United Kingdom': 'United Kingdom',
        'France': 'France',
        'Germany': 'Germany',
        'Australia': 'Australia',
        'USA': 'United States of America',
        'EIRE': 'Ireland',
        'Spain': 'Spain',
        'Netherlands': 'Netherlands',
        'Belgium': 'Belgium',
        'Switzerland': 'Switzerland',
        'Portugal': 'Portugal',
        'Norway': 'Norway',
        'Italy': 'Italy',
        'Channel Islands': 'United Kingdom',
        'Finland': 'Finland',
        'Cyprus': 'Cyprus',
        'Sweden': 'Sweden',
        'Austria': 'Austria',
        'Denmark': 'Denmark',
        'Poland': 'Poland',
        'Japan': 'Japan',
        'Israel': 'Israel',
        'RSA': 'South Africa',
        'Czech Republic': 'Czech Republic',
        'Canada': 'Canada',
        'Brazil': 'Brazil',
        'Greece': 'Greece',
        'Iceland': 'Iceland',
        'Malta': 'Malta',
        'Saudi Arabia': 'Saudi Arabia',
        'Bahrain': 'Bahrain',
        'Hong Kong': 'China',
        'Singapore': 'Singapore',
        'Lebanon': 'Lebanon',
        'Lithuania': 'Lithuania',
        'United Arab Emirates': 'United Arab Emirates'
    };

    async function init() {
        const resp = await fetch('data/world.json');
        const geoJson = await resp.json();
        echarts.registerMap('world', geoJson);

        chart = echarts.init(document.getElementById('chart-geo-sales'));

        chart.on('click', (params) => {
            if (params.name) {
                const country = Object.entries(COUNTRY_NAME_MAP)
                    .find(([, v]) => v === params.name)?.[0] || params.name;
                EventBus.emit('countryClick', country);
            }
        });

        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const rawData = await DataProcessor.getSalesByCountry(filters);

        const mapData = [];
        for (const d of rawData) {
            const geoName = COUNTRY_NAME_MAP[d.Country];
            if (geoName) {
                const existing = mapData.find(m => m.name === geoName);
                if (existing) {
                    existing.value += d.sales;
                } else {
                    mapData.push({ name: geoName, value: d.sales });
                }
            }
        }

        const maxVal = Math.max(...mapData.map(d => d.value), 1);

        const option = {
            title: { text: 'Sales by Country', left: 'center', textStyle: { fontSize: 15 } },
            visualMap: {
                min: 0, max: maxVal,
                left: 16, bottom: '5%',
                text: ['High', 'Low'],
                inRange: { color: ['#e0f3f8', '#ffffbf', '#fdae61', '#d73027'] },
                calculable: true
            },
            tooltip: {
                trigger: 'item',
                formatter: p => `${p.name}<br/>Sales: £${p.value ? p.value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'N/A'}`
            },
            series: [{
                type: 'map', map: 'world', roam: true,
                zoom: 1.4, center: [10, 52],
                data: mapData,
                emphasis: {
                    label: { show: true, fontSize: 12 },
                    itemStyle: { areaColor: '#ffd700' }
                }
            }]
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
```

---

## 第11步：客户 RFM 分析图（charts/customer-rfm.js）

```js
const CustomerRFMModule = (() => {
    let chart;
    let currentFilters = {};

    const SEGMENT_COLORS = {
        'VIP': '#e74c3c',
        'Regular': '#3498db',
        'Low Value': '#95a5a6',
        'At Risk': '#f39c12'
    };

    async function init() {
        chart = echarts.init(document.getElementById('chart-customer-rfm'));
        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getRFMData();

        const series = Object.entries(SEGMENT_COLORS).map(([seg, color]) => ({
            name: seg,
            type: 'scatter',
            data: data
                .filter(d => d.segment === seg)
                .map(d => [d.recency, d.frequency, d.monetary, d['Customer ID']]),
            symbolSize: d => Math.min(Math.sqrt(d[2]) * 0.3 + 3, 40),
            itemStyle: { color, opacity: 0.55 },
            emphasis: { itemStyle: { opacity: 0.9 } }
        }));

        const option = {
            title: { text: 'Customer RFM Analysis', left: 'center', textStyle: { fontSize: 15 } },
            legend: { data: Object.keys(SEGMENT_COLORS), bottom: 0 },
            tooltip: {
                formatter: p =>
                    `<b>${p.seriesName}</b><br/>
                     Customer: ${p.data[3]}<br/>
                     Recency: ${p.data[0]} days<br/>
                     Frequency: ${p.data[1]} orders<br/>
                     Monetary: £${p.data[2].toFixed(2)}`
            },
            xAxis: { name: 'Recency (days)', type: 'value', nameLocation: 'center', nameGap: 35 },
            yAxis: { name: 'Frequency (orders)', type: 'value', nameLocation: 'center', nameGap: 45 },
            grid: { left: '12%', right: '8%', top: '12%', bottom: '12%' },
            series
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
```

---

## 第12步：全局筛选器（filters.js）

```js
const FilterModule = (() => {
    let currentFilters = {
        dateFrom: null,
        dateTo: null,
        countries: [],
        productSearch: ''
    };

    async function init() {
        const dateRange = DataProcessor.getDateRange();
        const countries = DataProcessor.getCountries();

        document.getElementById('filter-date-from').min = dateRange.min;
        document.getElementById('filter-date-from').max = dateRange.max;
        document.getElementById('filter-date-to').min = dateRange.min;
        document.getElementById('filter-date-to').max = dateRange.max;

        const countryDiv = document.getElementById('filter-countries');
        countryDiv.innerHTML = countries.map(c =>
            `<label><input type="checkbox" value="${c}" class="country-cb" checked> ${c}</label>`
        ).join('');

        document.getElementById('btn-apply').addEventListener('click', applyFilters);
        document.getElementById('btn-reset').addEventListener('click', resetFilters);
        document.getElementById('filter-product').addEventListener('keydown', e => {
            if (e.key === 'Enter') applyFilters();
        });

        EventBus.on('countryClick', (country) => {
            document.querySelectorAll('#filter-countries .country-cb').forEach(cb => {
                cb.checked = (cb.value === country);
            });
            applyFilters();
        });
    }

    function getCurrentFilters() {
        return { ...currentFilters };
    }

    function applyFilters() {
        currentFilters.dateFrom = document.getElementById('filter-date-from').value || null;
        currentFilters.dateTo = document.getElementById('filter-date-to').value || null;
        currentFilters.countries = [...document.querySelectorAll('#filter-countries .country-cb:checked')]
            .map(cb => cb.value);
        currentFilters.productSearch = document.getElementById('filter-product').value.trim() || null;
        EventBus.emit('filterChange', currentFilters);
    }

    function resetFilters() {
        currentFilters = { dateFrom: null, dateTo: null, countries: [], productSearch: null };
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-product').value = '';
        document.querySelectorAll('#filter-countries .country-cb').forEach(cb => { cb.checked = true; });
        EventBus.emit('filterChange', currentFilters);
    }

    return { init, getCurrentFilters };
})();
```

---

## 第13步：主控制器（main.js）

```js
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
```

---

## 第14步：本地测试

```bash
cd online-retail-viz
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`，验证：

- [ ] 5个可视化视图全部正常渲染
- [ ] KPI数字随筛选更新
- [ ] 日期筛选 → 所有图表联动
- [ ] 国家筛选 → 所有图表联动
- [ ] 地图点击国家 → 筛选器联动
- [ ] 时间粒度按钮切换正常（日/周/月）
- [ ] 窗口缩放 → 图表自适应
- [ ] 浏览器 console 无报错

---

## 第15步：部署到 Netlify

### 方式一：Git 推送自动部署（推荐）

1. 将代码推送到 GitHub：
   ```bash
   git add .
   git commit -m "Complete interactive retail visualization dashboard"
   git push origin main
   ```

2. 登录 [Netlify](https://app.netlify.com/)，点击 **Add new site → Import an existing project → GitHub**

3. 授权并选择 `online-retail-viz` 仓库

4. 部署配置：
   - **Branch to deploy**: `main`
   - **Build command**: 留空（纯静态项目无需构建）
   - **Publish directory**: `.`（或 `/`）

5. 点击 **Deploy**，等待完成

6. 部署成功后会得到一个 Netlify 子域名，如 `https://online-retail-viz.netlify.app`

7. 可以在 **Site settings → Domain management** 中自定义子域名前缀

### 方式二：手动拖拽部署

如果不想用 GitHub 集成，也可以：

1. 在 Netlify 首页点击 **Deploy manually**，将整个项目文件夹拖入即可
2. 后续每次更新代码后重新拖拽

### 优势

- GitHub 仓库设为 **Private** 也不会影响 Netlify 部署
- 每次 `git push` 自动触发部署，无需手动操作
- 免费套餐包含 100GB 带宽，足够课程展示

---

## 技术栈总结

| 组件 | 选型 |
|------|------|
| 图表库 | ECharts 5.5 (CDN) |
| 前端框架 | 纯 HTML/CSS/JS（零依赖） |
| 数据预处理 | Python (pandas + openpyxl) |
| 数据格式 | JSON（聚合后，2-5MB） |
| 代码协作 | GitHub (Private 仓库) |
| 部署平台 | Netlify（自动部署） |
