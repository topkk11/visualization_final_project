# UK Online Retail — Interactive Sales Dashboard

基于 **Online Retail II** 数据集构建的交互式可视化分析仪表盘，用于探索英国在线零售商店的销售趋势、地理分布、商品表现和客户价值分析。

## 技术栈

- **ECharts 5.5** — 图表渲染（CDN 引入）
- **纯前端** — HTML + CSS + JavaScript，零构建依赖
- **Python (pandas)** — 数据预处理

## 项目结构

```
├── index.html                  # 主页面
├── css/
│   └── style.css               # 全局样式 + 响应式布局
├── js/
│   ├── data-loader.js          # 数据加载（fetch + 缓存）
│   ├── data-processor.js       # 数据查询 API
│   ├── charts/
│   │   ├── kpi-overview.js     # 概览指标卡
│   │   ├── sales-trend.js      # 销售趋势图（日/周/月）
│   │   ├── product-analysis.js # 商品 Top 15 柱状图
│   │   ├── geo-sales.js        # 世界地图销售分布
│   │   └── customer-rfm.js     # 客户 RFM 分析（环形图 + 分组柱状图）
│   ├── filters.js              # 全局筛选器
│   └── main.js                 # 事件总线 + 主控制器
├── data/
│   ├── retail_data.json        # 预处理聚合数据（~0.6 MB）
│   └── world.json              # ECharts 世界地图 GeoJSON
└── preprocess.py               # Python 数据预处理脚本
```

## 功能特性

### 可视化视图

| 视图 | 说明 |
|------|------|
| **KPI 概览卡片** | 总销售额、总订单数、平均客单价、活跃客户数 |
| **销售趋势图** | 折线+柱状组合图，支持日/周/月粒度切换和区域缩放 |
| **商品分析图** | Top 15 热销商品水平柱状图 |
| **地理分布图** | 世界地图热点，按国家展示销售额，点击联动筛选 |
| **客户 RFM 分析** | 环形图（客户分群占比）+ 分组柱状图（各群平均 R/F/M 指标） |

### 交互功能

- **全局筛选**：日期范围、国家多选、商品名称搜索
- **图表联动**：地图点击国家 → 全部图表同步刷新
- **时间粒度切换**：趋势图支持按日/周/月查看
- **响应式布局**：适配桌面端和平板端

## 快速开始

### 1. 数据预处理

```bash
pip install pandas openpyxl
python preprocess.py
```

脚本会读取 `online_retail_II(1).xlsx`，清洗并聚合后生成 `data/retail_data.json`。

### 2. 启动本地服务

```bash
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`

### 3. 部署（Netlify）

将项目推送至 GitHub，在 [Netlify](https://app.netlify.com/) 中导入仓库即可自动部署：

- **Publish directory**: `.`（根目录）
- 无需 Build command

## 数据来源

[UCI Machine Learning Repository — Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii)

包含 2009-2011 年间英国在线零售商的交易记录，约 107 万条。

## License

MIT
