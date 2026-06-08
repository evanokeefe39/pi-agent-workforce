# DuckDB SQL Cookbook

10 common patterns for data analysis. All examples use DuckDB syntax.

## 1. Direct file query

```sql
SELECT * FROM read_csv('/path/to/data.csv') LIMIT 10;
SELECT * FROM read_json('/path/to/data.jsonl', auto_detect=true) LIMIT 10;
SELECT * FROM read_parquet('/path/to/data.parquet') LIMIT 10;
```

## 2. Schema inspection

```sql
DESCRIBE SELECT * FROM read_csv('/path/to/data.csv');
-- Returns: column_name, column_type, null, key, default, extra
```

## 3. Statistical summary

```sql
SUMMARIZE SELECT * FROM read_csv('/path/to/data.csv');
-- Returns: column_name, column_type, min, max, approx_unique, avg, std, q25, q50, q75, count, null_percentage
```

## 4. Aggregation with grouping

```sql
SELECT
  content_type,
  COUNT(*) AS post_count,
  AVG(save_rate) AS avg_save_rate,
  AVG(engagement_rate) AS avg_engagement
FROM read_csv('/path/to/posts.csv')
GROUP BY ALL
ORDER BY avg_save_rate DESC;
```

## 5. Quantile distribution

```sql
SELECT
  QUANTILE_CONT(save_rate, [0.10, 0.25, 0.50, 0.75, 0.90]) AS percentiles,
  MIN(save_rate) AS min_val,
  MAX(save_rate) AS max_val,
  STDDEV(save_rate) AS std_dev
FROM data;
```

## 6. Pivot / cross-tabulation

```sql
PIVOT (
  SELECT account, content_type, save_rate FROM posts
)
ON content_type
USING AVG(save_rate);
-- Produces: account | listicle | tutorial | demo | ...
```

## 7. Window functions (trends and deltas)

```sql
SELECT
  date,
  value,
  value - LAG(value) OVER (ORDER BY date) AS delta,
  AVG(value) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d
FROM time_series
ORDER BY date;
```

## 8. Top-N with ranking

```sql
SELECT
  *,
  ROW_NUMBER() OVER (ORDER BY save_rate DESC) AS rank
FROM accounts
QUALIFY rank <= 10;
```

## 9. JSON/JSONL ingestion

```sql
-- Auto-detect schema from JSONL
SELECT * FROM read_json('/path/to/findings.jsonl', auto_detect=true);

-- Extract nested fields
SELECT
  json_extract_string(data, '$.claim') AS claim,
  json_extract_string(data, '$.sources[0].source_name') AS primary_source
FROM read_json('/path/to/findings.jsonl', columns={data: 'JSON'});
```

## 10. Export to file

```sql
-- CSV export
COPY (SELECT * FROM analysis_results) TO '/tmp/output.csv' (HEADER, DELIMITER ',');

-- JSON export
COPY (SELECT * FROM analysis_results) TO '/tmp/output.json' (FORMAT JSON, ARRAY true);

-- Parquet export (efficient for large datasets)
COPY (SELECT * FROM analysis_results) TO '/tmp/output.parquet' (FORMAT PARQUET);
```

## Bonus: Computed columns pattern

When computing derived metrics, use a CTE to keep it clean:

```sql
WITH base AS (
  SELECT *,
    ROUND(saves::FLOAT / NULLIF(views, 0) * 100, 2) AS save_rate,
    ROUND(likes::FLOAT / NULLIF(posts, 0), 0) AS likes_per_post,
    ROUND(hearts::FLOAT / NULLIF(followers, 0), 2) AS hearts_per_fan
  FROM read_csv('/tmp/accounts.csv')
)
SELECT * FROM base ORDER BY save_rate DESC;
```

Use `NULLIF(x, 0)` to prevent division-by-zero errors.
