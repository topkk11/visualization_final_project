# 交互式可视化系统 — 代码实现模块分工（3人均衡版）

## 项目背景

- **数据集**: Online Retail II — 英国在线零售交易数据（~107万行）
  - 字段: Invoice, StockCode, Description, Quantity, InvoiceDate, Price, Customer ID, Country
- **目标**: 构建一个交互式可视化系统，支持销售数据分析与客户行为洞察
- **推荐技术栈**: ECharts + 纯前端 (HTML/CSS/JS)，部署到 GitHub Pages

---

## 总体架构

```
项目结构:
├── index.html              # 主页面布局
├── css/
│   └── style.css           # 全局样式
├── js/
│   ├── data-loader.js      # 数据加载
│   ├── data-processor.js   # 数据聚合查询API
│   ├── charts/
│   │   ├── kpi-overview.js       # 概览指标卡
│   │   ├── sales-trend.js        # 销售趋势图
│   │   ├── product-analysis.js   # 商品分析图
│   │   ├── geo-sales.js          # 地理分布图
│   │   └── customer-rfm.js       # 客户RFM分析
│   ├── filters.js           # 全局筛选器
│   └── main.js              # 主控制器 + 事件总线
├── data/
│   └── retail_data.json     # 预处理后的聚合数据
└── preprocess.py            # Python数据预处理脚本
```

---

## 成员分工

### 👤 成员A：数据基础 + 概览 + 商品分析

| 模块 | 文件 | 说明 |
|------|------|------|
| 数据预处理 | `preprocess.py` | Python脚本：读取Excel、清洗、聚合，导出JSON |
| 数据加载 | `data-loader.js` | fetch加载JSON，缓存数据，暴露 `getData()` |
| 数据查询API | `data-processor.js` | 实现全部数据查询函数（按时间/国家/商品/RFM聚合） |
| 概览指标卡 | `charts/kpi-overview.js` | 4个指标卡片：总销售额、订单数、客单价、活跃客户数 |
| 商品分析图 | `charts/product-analysis.js` | 水平柱状图（Top N热销）+ 饼图（品类占比） |

**关键职责**:
1. 用Python读取原始Excel → 清洗 → 聚合 → 导出 `data/retail_data.json`
2. 定义并实现全部数据查询API接口，供成员B和C调用
3. 实现KPI卡片和商品分析两个可视化模块

---

### 👤 成员B：销售趋势 + 客户分析

| 模块 | 文件 | 说明 |
|------|------|------|
| 销售趋势图 | `charts/sales-trend.js` | 折线+柱状组合图，多粒度切换（日/周/月），区域缩放 |
| 客户RFM图 | `charts/customer-rfm.js` | 散点气泡图，客户价值分层，悬停详情 |

**关键职责**:
1. 销售趋势图：最核心的时序图表，支持时间粒度切换、多国对比、dataZoom缩放
2. RFM散点图：X=最近购买(Recency)、Y=购买频率(Frequency)、气泡=消费金额(Monetary)，颜色编码客户分群

> 这两个图表逻辑较复杂（趋势图多粒度聚合 + RFM计算），但数量少，工作量与成员A、C均衡

---

### 👤 成员C：地理分布 + 筛选交互 + 页面集成 + 部署

| 模块 | 文件 | 说明 |
|------|------|------|
| 地理分布图 | `charts/geo-sales.js` | 世界地图热力分布，点击联动筛选 |
| 全局筛选器 | `filters.js` | 日期/国家/商品筛选控件，应用&重置按钮 |
| 主控制器 | `main.js` | 事件总线、模块初始化、图表联动调度、resize管理 |
| 页面布局 | `index.html` | HTML结构 + 网格布局 |
| 全局样式 | `css/style.css` | 配色、卡片、响应式适配 |
| 部署上线 | — | GitHub Pages部署，确保公开可访问 |

**关键职责**:
1. 地理图需引入世界地图GeoJSON，实现悬停和点击联动
2. 筛选器是全局交互中枢，所有图表通过事件总线响应筛选变化
3. 负责所有模块的集成联调和最终部署

---

## 工作量对照

| 成员 | 模块数 | 核心内容 | 难度 |
|------|--------|---------|------|
| A | 5个 | Python预处理 + JS数据层 + KPI + 商品图 | 中等 |
| B | 2个 | 销售趋势（复杂） + RFM（中等复杂） | 中等偏高 |
| C | 6个 | 地图 + 筛选 + 主控 + 布局 + 样式 + 部署 | 中等 |

> 成员B模块少但每个图表逻辑复杂；成员A/C模块多但单个难度较低。三人总工时大致均衡。

---

## 协作接口约定

三人开工前共同确认以下接口：

```js
// ===== 成员A提供的数据API（data-processor.js）=====
DataProcessor.getKPIData(filters)
  → { totalSales, totalOrders, avgOrderValue, activeCustomers, totalCustomers }

DataProcessor.getSalesByTime(filters, granularity)  // granularity: 'day'|'week'|'month'
  → [{ date: '2010-01', sales: 12345, orders: 678 }, ...]

DataProcessor.getSalesByCountry(filters)
  → [{ country: 'United Kingdom', sales: 99999, orders: 888, avgPrice: 4.5 }, ...]

DataProcessor.getTopProducts(filters, topN, sortBy)  // sortBy: 'sales'|'quantity'
  → [{ name: 'XXX', sales: 12345, quantity: 678 }, ...]

DataProcessor.getRFMData(filters)
  → [{ customerId: 12346, recency: 30, frequency: 5, monetary: 1234, segment: 'high' }, ...]

// ===== 统一的筛选参数格式 =====
filters = {
  dateFrom: '2010-01-01',   // 或 null
  dateTo: '2011-12-31',     // 或 null
  countries: ['United Kingdom', 'France'],  // 或 [] 表示全部
  productSearch: ''         // 商品关键词搜索，'' 表示全部
}

// ===== 每个图表暴露统一的更新接口 =====
chartInstance.update(filters)   // 接收筛选参数，刷新自身

// ===== 事件总线（main.js 中注册）=====
EventBus.on('filterChange', (filters) => {
  // 遍历所有图表调用 update(filters)
});
EventBus.on('countryClick', (country) => {
  // 地图点击 → 更新筛选器 → 广播筛选变化
});
```

---

## 推荐协作流程

```
第1步 (共同15min): 约定接口 → 搭建GitHub仓库 → 创建文件骨架
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
第2步 成员A: preprocess.py   成员B: 熟悉ECharts    成员C: index.html骨架
       清洗数据、导出JSON           折线图+散点图       + CSS网格布局
       定义数据API接口签名         API文档             + 引入ECharts CDN
              │                     │                     │
              │  发布JSON文件       │                     │
              │  和API签名          │                     │
        ┌─────┴─────────────────────┴─────────────────────┘
        ▼
第3步 成员A: data-loader.js   成员B: sales-trend.js  成员C: geo-sales.js
       data-processor.js            customer-rfm.js        filters.js
       kpi-overview.js                                    main.js (事件总线)
              │                     │                     │
        ┌─────┴─────────────────────┴─────────────────────┘
        ▼
第4步 成员A: product-analysis.js   成员B: 图表调试    成员C: 集成联调
                                                     style.css + 响应式
              │                     │                     │
        ┌─────┴─────────────────────┴─────────────────────┘
        ▼
第5步 (共同): 联调测试 → 修bug → 部署GitHub Pages → 验证URL
```
