import pandas as pd

f1 = r'C:\Users\priya\Downloads\barshi.xlsx'
f2 = r'C:\Users\priya\Downloads\9afe08cb1b664f27b46f248efa3f82c5.xlsx'

print('--- barshi.xlsx ---')
try:
    df1 = pd.read_excel(f1)
    print('Columns:', df1.columns.tolist())
    mask = df1.apply(lambda row: row.astype(str).str.contains('19004214').any(), axis=1)
    print(df1[mask].to_string())
except Exception as e:
    print('Error:', e)

print('\n--- closing stock ---')
try:
    df2 = pd.read_excel(f2)
    print('Columns:', df2.columns.tolist())
    mask2 = df2.apply(lambda row: row.astype(str).str.contains('19004214').any(), axis=1)
    print(df2[mask2].to_string())
except Exception as e:
    print('Error:', e)
