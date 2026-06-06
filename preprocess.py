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

# Sales by country (top 30)
print("Aggregating by country...")
sales_by_country = df_valid.groupby('Country').agg(
    sales=('TotalAmount', 'sum'),
    orders=('Invoice', 'nunique'),
    customers=('Customer ID', 'nunique'),
    avgPrice=('Price', 'mean')
).reset_index().sort_values('sales', ascending=False).head(30).to_dict('records')

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

rfm = df_valid.groupby('Customer ID').agg(
    recency=('InvoiceDate', lambda x: (ref_date - x.max()).days),
    frequency=('Invoice', 'nunique'),
    monetary=('TotalAmount', 'sum')
).reset_index()

rfm = rfm[rfm['Customer ID'] != -1]

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

rfm_data = rfm[['Customer ID', 'recency', 'frequency', 'monetary', 'segment']].to_dict('records')

# Assemble output
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
        'min': str(df_valid['DateStr'].min()),
        'max': str(df_valid['DateStr'].max())
    },
    'countries': sorted(df_valid['Country'].unique().tolist())
}

# Serialize - convert numpy types to native Python
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        import numpy as np
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

json_str = json.dumps(output, ensure_ascii=False, cls=NpEncoder)

with open('data/retail_data.json', 'w', encoding='utf-8') as f:
    f.write(json_str)

print(f'Done. JSON size: {len(json_str):,} bytes ({len(json_str)/1024/1024:.1f} MB)')
print(f'Date range: {output["dateRange"]["min"]} to {output["dateRange"]["max"]}')
print(f'Countries: {len(output["countries"])} unique')
print(f'RFM customers: {len(rfm_data):,}')
