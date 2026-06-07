"""
Preprocess the 1M Global E-Commerce dataset into the project's JSON format.
Input:  ecommerce_dataset_+1m.csv  (392MB, 1M rows, 62 cols, 2024-2026)
Output: data/global_retail_data.json
"""
import pandas as pd
import json
import datetime
import numpy as np

print("Reading CSV (392MB, this may take a minute)...")
df = pd.read_csv('ecommerce_dataset_+1m.csv')
print(f'Total rows: {len(df)}')

# Parse dates
df['order_date'] = pd.to_datetime(df['order_date'])
df['order_date_str'] = df['order_date'].dt.date.astype(str)

# ---- Clean & transform ----
df['TotalAmount'] = df['total_price_usd']
df['Quantity'] = df['quantity']
df['Price'] = df['unit_price_usd']
df['CustomerID'] = df['customer_id']
df['Country'] = df['country']
df['StockCode'] = df['product_id'].astype(str)
df['Description'] = df['product_name'].fillna('Unknown')
df['Invoice'] = df['order_id'].astype(str)

# Returns
df['IsReturn'] = df['order_status'] == 'Returned'
df_valid = df[df['order_status'] != 'Returned'].copy()

df_valid['YearMonth'] = df_valid['order_date'].dt.to_period('M').astype(str)
df_valid['YearWeek'] = df_valid['order_date'].dt.to_period('W').astype(str)
df_valid['DateStr'] = df_valid['order_date'].dt.date.astype(str)

# Category
df_valid['Category'] = df_valid['category'].fillna('Unknown')
df_valid['SubCategory'] = df_valid['sub_category'].fillna('Unknown')

# ---- KPI ----
total_invoices = df_valid['Invoice'].nunique()
total_customers = df_valid['CustomerID'].nunique()
total_sales = round(float(df_valid['TotalAmount'].sum()), 2)

kpi = {
    'totalSales': total_sales,
    'totalOrders': int(total_invoices),
    'totalCustomers': int(total_customers),
    'totalQuantity': int(df_valid['Quantity'].sum()),
    'avgOrderValue': round(float(total_sales / total_invoices), 2),
    'totalProfit': round(float(df_valid['profit_usd'].sum()), 2),
    'avgDiscountPct': round(float(df_valid['discount_percent'].mean()), 1)
}
print(f'KPI: {json.dumps(kpi, indent=2)}')

# ---- Sales by time ----
print("Aggregating sales by month...")
sales_by_month = df_valid.groupby('YearMonth').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('CustomerID', 'nunique'),
    profit=('profit_usd', 'sum')
).reset_index().sort_values('YearMonth').to_dict('records')

print("Aggregating sales by week...")
sales_by_week = df_valid.groupby('YearWeek').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    profit=('profit_usd', 'sum')
).reset_index().sort_values('YearWeek').to_dict('records')

print("Aggregating sales by day...")
sales_by_day = df_valid.groupby('DateStr').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    profit=('profit_usd', 'sum')
).reset_index().sort_values('DateStr').to_dict('records')

# ---- Sales by country ----
print("Aggregating by country...")
sales_by_country = df_valid.groupby('Country').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('CustomerID', 'nunique'),
    avgPrice=('Price', 'mean'),
    profit=('profit_usd', 'sum'),
    avgDiscount=('discount_percent', 'mean'),
    shippingCost=('shipping_cost_usd', 'sum')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# ---- Top 200 products ----
print("Aggregating top products...")
top_products = df_valid.groupby(['StockCode', 'Description']).agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum'),
    orders=('Invoice', 'nunique'),
    profit=('profit_usd', 'sum')
).reset_index().sort_values('sales', ascending=False).head(200).to_dict('records')

# ---- Categories (main + sub) ----
categories = df_valid.groupby('Category').agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum'),
    profit=('profit_usd', 'sum')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

sub_categories = df_valid.groupby(['Category', 'SubCategory']).agg(
    sales=('TotalAmount', 'sum'),
    quantity=('Quantity', 'sum')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# ---- Payment method distribution ----
payment_methods = df_valid.groupby('payment_method').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique')
).reset_index().sort_values('sales', ascending=False).to_dict('records')

# ---- Returns by month ----
returns = df[df['IsReturn'] == True].copy()
returns['YearMonth'] = returns['order_date'].dt.to_period('M').astype(str)
returns_by_month = returns.groupby('YearMonth').agg(
    returnCount=('Invoice', 'count'),
    returnAmount=('TotalAmount', 'sum')
).reset_index().to_dict('records')

# Returns by reason
if 'return_reason' in df.columns:
    returns_reasons = df[df['return_reason'].notna()].groupby('return_reason').size().reset_index(name='count')
    returns_reasons = returns_reasons.sort_values('count', ascending=False).to_dict('records')
else:
    returns_reasons = []

# ---- RFM ----
print("Computing RFM...")
ref_date = df_valid['order_date'].max() + datetime.timedelta(days=1)

# Determine each customer's primary country
customer_country = df_valid.groupby('CustomerID')['Country'].agg(
    lambda x: x.value_counts().index[0]
).reset_index()
customer_country.columns = ['CustomerID', 'PrimaryCountry']

# Get customer segments from the data
customer_seg = df_valid.groupby('CustomerID')['customer_segment'].first().reset_index()

rfm = df_valid.groupby('CustomerID').agg(
    recency=('order_date', lambda x: (ref_date - x.max()).days),
    frequency=('Invoice', 'nunique'),
    monetary=('TotalAmount', 'sum'),
    total_profit=('profit_usd', 'sum'),
    avg_discount=('discount_percent', 'mean')
).reset_index()

# Merge country and original segment
rfm = rfm.merge(customer_country, on='CustomerID', how='left')
rfm = rfm.merge(customer_seg, on='CustomerID', how='left')
rfm['Country'] = rfm['PrimaryCountry'].fillna('Unknown')
rfm = rfm.drop(columns=['PrimaryCountry'])

# Compute RFM scores
print("  Scoring RFM...")
rfm_scores_ok = True
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
    print(f"  RFM scoring fallback: {e}")
    rfm_scores_ok = False
    # Use percentile-based scoring manually
    try:
        r_bins = [rfm['recency'].quantile(i/3) for i in range(4)]
        f_bins = [rfm['frequency'].quantile(i/3) for i in range(4)]
        m_bins = [rfm['monetary'].quantile(i/3) for i in range(4)]
        rfm['R_score'] = pd.cut(rfm['recency'], bins=r_bins, labels=['high', 'mid', 'low'], include_lowest=True, duplicates='drop')
        rfm['F_score'] = pd.cut(rfm['frequency'], bins=f_bins, labels=['low', 'mid', 'high'], include_lowest=True, duplicates='drop')
        rfm['M_score'] = pd.cut(rfm['monetary'], bins=m_bins, labels=['low', 'mid', 'high'], include_lowest=True, duplicates='drop')
        rfm['segment'] = rfm.apply(classify, axis=1)
        rfm_scores_ok = True
        print("  Manual percentile scoring succeeded")
    except Exception as e2:
        print(f"  All scoring failed: {e2}")
        rfm['segment'] = 'Regular'

print(f"  Segments: {rfm['segment'].value_counts().to_dict()}")

# Stratified sample for scatter chart (keep JSON manageable)
MAX_RFM = 50000
if len(rfm) > MAX_RFM:
    print(f"  Sampling RFM from {len(rfm):,} to {MAX_RFM:,} customers...")
    # Make sure segment column exists
    if 'segment' not in rfm.columns:
        rfm['segment'] = 'Regular'
    # Stratified by segment to preserve distribution
    seg_counts = rfm['segment'].value_counts()
    total = len(rfm)
    rfm_sample_parts = []
    for seg, cnt in seg_counts.items():
        n = max(1, int(MAX_RFM * cnt / total))
        n = min(n, cnt)
        part = rfm[rfm['segment'] == seg].sample(n=n, random_state=42)
        rfm_sample_parts.append(part)
    rfm_sample = pd.concat(rfm_sample_parts, ignore_index=True)
    # If we got more than MAX_RFM due to rounding, trim
    if len(rfm_sample) > MAX_RFM:
        rfm_sample = rfm_sample.sample(n=MAX_RFM, random_state=42)
    print(f"  Sampled: {len(rfm_sample):,}")
    del rfm_sample_parts
else:
    rfm_sample = rfm

# Build RFM output
rfm_cols = ['CustomerID', 'Country', 'recency', 'frequency', 'monetary', 'segment',
            'customer_segment', 'total_profit', 'avg_discount']
# Verify all columns exist
missing_cols = [c for c in rfm_cols if c not in rfm_sample.columns]
if missing_cols:
    for c in missing_cols:
        rfm_sample[c] = 0  # fallback
rfm_data = rfm_sample[rfm_cols].to_dict('records')
# Rename for frontend compatibility
for d in rfm_data:
    d['Customer ID'] = d.pop('CustomerID')

print(f"  Full RFM customers: {len(rfm)}, Sampled for JSON: {len(rfm_data)}")

# ---- Country-level customer metrics ----
print("Computing country customer metrics...")
country_customer_base = df_valid.groupby('Country').agg(
    total_customers=('CustomerID', 'nunique'),
    total_sales=('TotalAmount', 'sum'),
    total_orders=('Invoice', 'nunique'),
    total_profit=('profit_usd', 'sum'),
    avg_shipping_cost=('shipping_cost_usd', 'mean')
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

# Merge
country_customer = country_customer_base.merge(rfm_country_seg, on='Country', how='left').fillna(0)
country_customer = country_customer.merge(country_avg_rfm, on='Country', how='left')
for col in ['avg_frequency', 'avg_monetary', 'avg_recency']:
    country_customer[col] = country_customer[col].fillna(0)
for col in ['VIP_count', 'Regular_count', 'LowValue_count', 'AtRisk_count']:
    country_customer[col] = country_customer[col].astype(int)
country_customer_data = country_customer.to_dict('records')

# ---- Country name mapping (dataset country → GeoJSON name) ----
country_name_map = {
    'United Kingdom': 'United Kingdom',
    'France': 'France',
    'Germany': 'Germany',
    'Australia': 'Australia',
    'United States': 'United States of America',
    'Netherlands': 'Netherlands',
    'Belgium': 'Belgium',
    'Spain': 'Spain',
    'Italy': 'Italy',
    'Canada': 'Canada',
}

# ---- Assemble output ----
output = {
    'kpi': kpi,
    'salesByMonth': sales_by_month,
    'salesByWeek': sales_by_week,
    'salesByDay': sales_by_day,
    'salesByCountry': sales_by_country,
    'topProducts': top_products,
    'categories': categories,
    'subCategories': sub_categories,
    'paymentMethods': payment_methods,
    'returnsByMonth': returns_by_month,
    'returnsReasons': returns_reasons,
    'rfm': rfm_data,
    'rfmFullCount': int(len(rfm)),
    'countryCustomer': country_customer_data,
    'countryNameMap': country_name_map,
    'dateRange': {
        'min': str(df_valid['DateStr'].min()),
        'max': str(df_valid['DateStr'].max())
    },
    'countries': sorted(df_valid['Country'].unique().tolist())
}

# ---- Sanitize NaN/Inf ----
def sanitize(obj, _seen=None):
    if _seen is None:
        _seen = set()
    obj_id = id(obj)
    if obj_id in _seen:
        return obj
    _seen.add(obj_id)

    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize(v, _seen) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v, _seen) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        val = float(obj)
        return None if (np.isnan(val) or np.isinf(val)) else val
    if isinstance(obj, np.ndarray):
        return sanitize(obj.tolist(), _seen)
    return obj

output = sanitize(output)
json_str = json.dumps(output, ensure_ascii=False)

out_path = 'data/global_retail_data.json'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(json_str)

print(f'Done. JSON size: {len(json_str):,} bytes ({len(json_str)/1024/1024:.1f} MB)')
print(f'Date range: {output["dateRange"]["min"]} to {output["dateRange"]["max"]}')
print(f'Countries: {len(output["countries"])} unique: {output["countries"]}')
print(f'RFM: {len(rfm_data):,} sampled from {len(rfm):,} total customers')
print(f'Products (top 200 of {df_valid["StockCode"].nunique():,})')
print(f'Categories: {df_valid["Category"].nunique()}')
print(f'Segments: {rfm["segment"].value_counts().to_dict()}')
