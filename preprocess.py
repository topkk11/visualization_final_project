import pandas as pd
import json
import datetime

print("Reading Excel...")
df1 = pd.read_excel('online_retail_II(1).xlsx', sheet_name='Year 2009-2010')
df2 = pd.read_excel('online_retail_II(1).xlsx', sheet_name='Year 2010-2011')
df = pd.concat([df1, df2], ignore_index=True)
print(f'Total rows: {len(df)}')

# Clean
df['TotalAmount'] = df['Quantity'] * df['Price']
df['IsReturn'] = df['Quantity'] < 0
df_valid = df[df['Quantity'] > 0].copy()
df_valid['Customer ID'] = df_valid['Customer ID'].fillna(-1).astype(int)
df_valid['Description'] = df_valid['Description'].fillna('Unknown')
df_valid['InvoiceDate'] = pd.to_datetime(df_valid['InvoiceDate'])
df_valid['YearMonth'] = df_valid['InvoiceDate'].dt.to_period('M').astype(str)
df_valid['YearWeek'] = df_valid['InvoiceDate'].dt.to_period('W').astype(str)
df_valid['DateStr'] = df_valid['InvoiceDate'].dt.date.astype(str)

def get_category(code):
    code = str(code).strip().upper()
    if code[0].isdigit():
        return 'Numeric'
    return code[0]

df_valid['Category'] = df_valid['StockCode'].apply(get_category)

# KPI
kpi = {
    'totalSales': round(float(df_valid['TotalAmount'].sum()), 2),
    'totalOrders': int(df_valid['Invoice'].nunique()),
    'totalCustomers': int(df_valid[df_valid['Customer ID'] != -1]['Customer ID'].nunique()),
    'totalQuantity': int(df_valid['Quantity'].sum()),
    'avgOrderValue': round(float(df_valid['TotalAmount'].sum() / df_valid['Invoice'].nunique()), 2)
}

# Sales by time
print("Aggregating sales by month...")
sales_by_month = df_valid.groupby('YearMonth').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('Customer ID', 'nunique')
).reset_index().to_dict('records')

print("Aggregating sales by week...")
sales_by_week = df_valid.groupby('YearWeek').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

print("Aggregating sales by day...")
sales_by_day = df_valid.groupby('DateStr').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

# Country × Month sales (for country-filtered trend chart)
print("Aggregating country-month sales...")
country_sales_by_month = df_valid.groupby(['Country', 'YearMonth']).agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

# Country × Week sales
print("Aggregating country-week sales...")
country_sales_by_week = df_valid.groupby(['Country', 'YearWeek']).agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

# Country × Day sales
print("Aggregating country-day sales...")
country_sales_by_day = df_valid.groupby(['Country', 'DateStr']).agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().to_dict('records')

# Sales by country (all countries, not just top 30)
print("Aggregating by country...")
sales_by_country = df_valid.groupby('Country').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('Customer ID', 'nunique'),
    avgPrice=('Price', 'mean')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# Top products
print("Aggregating top products...")
top_products = df_valid.groupby(['StockCode', 'Description']).agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().sort_values('sales', ascending=False).head(100).to_dict('records')

# Categories
categories = df_valid.groupby('Category').agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# Returns by month
returns = df[df['IsReturn'] == True].copy()
returns['YearMonth'] = returns['InvoiceDate'].dt.to_period('M').astype(str)
returns_by_month = returns.groupby('YearMonth').agg(
    returnCount=('Invoice', 'count'),
    returnAmount=('TotalAmount', 'sum')
).reset_index().to_dict('records')

# RFM
print("Computing RFM...")
ref_date = df_valid['InvoiceDate'].max() + datetime.timedelta(days=1)

# Determine each customer's primary country BEFORE RFM aggregation
print("  Determining customer primary countries...")
customer_country = df_valid[df_valid['Customer ID'] != -1].groupby('Customer ID')['Country'].agg(
    lambda x: x.value_counts().index[0]  # most frequent country
).reset_index()
customer_country.columns = ['Customer ID', 'PrimaryCountry']

rfm = df_valid.groupby('Customer ID').agg(
    recency=('InvoiceDate', lambda x: (ref_date - x.max()).days),
    frequency=('Invoice', 'nunique'),
    monetary=('TotalAmount', 'sum')
).reset_index()

rfm = rfm[rfm['Customer ID'] != -1]

# Merge primary country into RFM
rfm = rfm.merge(customer_country, on='Customer ID', how='left')
rfm['Country'] = rfm['PrimaryCountry'].fillna('Unknown')
rfm = rfm.drop(columns=['PrimaryCountry'])

try:
    rfm['R_score'] = pd.qcut(rfm['recency'], 3, labels=['high', 'mid', 'low'], duplicates='drop')
    rfm['F_score'] = pd.qcut(rfm['frequency'], 3, labels=['low', 'mid', 'high'], duplicates='drop')
    rfm['M_score'] = pd.qcut(rfm['monetary'], 3, labels=['low', 'mid', 'high'], duplicates='drop')

    def classify(row):
        try:
            if row['R_score'] == 'high' and row['F_score'] == 'high' and row['M_score'] == 'high':
                return 'VIP'
            elif row['R_score'] == 'low':
                return 'At Risk'
            elif row['F_score'] == 'low' and row['M_score'] == 'low':
                return 'Low Value'
            else:
                return 'Regular'
        except:
            return 'Regular'

    rfm['segment'] = rfm.apply(classify, axis=1)
except Exception as e:
    print(f"RFM scoring fallback: {e}")
    rfm['segment'] = 'Regular'

rfm_data = rfm[['Customer ID', 'Country', 'recency', 'frequency', 'monetary', 'segment']].to_dict('records')

# Country-level customer metrics (for country comparison chart + geo map segment view)
print("Computing country customer metrics...")
country_customer_base = df_valid.groupby('Country').agg(
    total_customers=('Customer ID', 'nunique'),
    total_sales=('TotalAmount', 'sum'),
    total_orders=('Invoice', 'nunique')
).reset_index()

# Per-country segment distribution
rfm_country_seg = rfm.groupby(['Country', 'segment']).size().unstack(fill_value=0)
for seg in ['VIP', 'Regular', 'Low Value', 'At Risk']:
    if seg not in rfm_country_seg.columns:
        rfm_country_seg[seg] = 0
rfm_country_seg = rfm_country_seg[['VIP', 'Regular', 'Low Value', 'At Risk']]
rfm_country_seg.columns = ['VIP_count', 'Regular_count', 'LowValue_count', 'AtRisk_count']
rfm_country_seg = rfm_country_seg.reset_index()

# Per-country average RFM metrics
country_avg_rfm = rfm.groupby('Country').agg(
    avg_frequency=('frequency', 'mean'),
    avg_monetary=('monetary', 'mean'),
    avg_recency=('recency', 'mean')
).reset_index()
for col in ['avg_frequency', 'avg_monetary', 'avg_recency']:
    country_avg_rfm[col] = country_avg_rfm[col].round(1)

# Merge all country-level data
country_customer = country_customer_base.merge(rfm_country_seg, on='Country', how='left').fillna(0)
country_customer = country_customer.merge(country_avg_rfm, on='Country', how='left')
# Fill NaN from merge (countries with no RFM customers) with 0
for col in ['avg_frequency', 'avg_monetary', 'avg_recency']:
    country_customer[col] = country_customer[col].fillna(0)
# Convert segment counts to int
for col in ['VIP_count', 'Regular_count', 'LowValue_count', 'AtRisk_count']:
    country_customer[col] = country_customer[col].astype(int)
country_customer_data = country_customer.to_dict('records')

# Country name mapping (dataset name -> GeoJSON name for ECharts world map)
country_name_map = {
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
    'United Arab Emirates': 'United Arab Emirates',
    'Bermuda': 'Bermuda',
    'European Community': 'Belgium',
    'Korea': 'South Korea',
    'Nigeria': 'Nigeria',
    'Thailand': 'Thailand',
    'Unspecified': 'United Kingdom',
    'West Indies': 'Jamaica'
}

# Assemble output
output = {
    'kpi': kpi,
    'salesByMonth': sales_by_month,
    'salesByWeek': sales_by_week,
    'salesByDay': sales_by_day,
    'countrySalesByMonth': country_sales_by_month,
    'countrySalesByWeek': country_sales_by_week,
    'countrySalesByDay': country_sales_by_day,
    'salesByCountry': sales_by_country,
    'topProducts': top_products,
    'categories': categories,
    'returnsByMonth': returns_by_month,
    'rfm': rfm_data,
    'countryCustomer': country_customer_data,
    'countryNameMap': country_name_map,
    'dateRange': {
        'min': str(df_valid['DateStr'].min()),
        'max': str(df_valid['DateStr'].max())
    },
    'countries': sorted(df_valid['Country'].unique().tolist())
}

# Serialize - convert numpy types to native Python, handle NaN/Infinity
def sanitize(obj, _seen=None):
    """Recursively replace NaN/Infinity with None (serializes as null in JSON)."""
    if _seen is None:
        _seen = set()
    obj_id = id(obj)
    if obj_id in _seen:
        return obj
    _seen.add(obj_id)

    import numpy as np
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize(v, _seen) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v, _seen) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        val = float(obj)
        return None if (np.isnan(val) or np.isinf(val)) else val
    if isinstance(obj, np.ndarray):
        return sanitize(obj.tolist(), _seen)
    return obj

output = sanitize(output)
json_str = json.dumps(output, ensure_ascii=False)

with open('data/retail_data.json', 'w', encoding='utf-8') as f:
    f.write(json_str)

print(f'Done. JSON size: {len(json_str):,} bytes ({len(json_str)/1024/1024:.1f} MB)')
print(f'Date range: {output["dateRange"]["min"]} to {output["dateRange"]["max"]}')
print(f'Countries: {len(output["countries"])} unique')
print(f'RFM customers: {len(rfm_data):,}')
