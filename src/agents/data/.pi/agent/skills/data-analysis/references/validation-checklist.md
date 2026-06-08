# Validation Checklist

Post-execution checks for the VALIDATE phase. Run these after ANALYZE, before PUBLISH.

## Critical (fail the analysis, re-execute)

- **Empty result set:** Query returned 0 rows when rows were expected. Check: wrong file path, wrong column name, overly restrictive WHERE clause.
- **All nulls in key column:** A column that should have values is entirely NULL. Check: type mismatch on import, wrong column reference.
- **Negative counts:** COUNT, SUM of positive values, or row_count < 0. Indicates computation error.
- **Percentages outside 0-100:** save_rate, engagement_rate, or any percentage metric outside valid range. Check: wrong denominator, missing * 100, integer division.
- **Division by zero results:** NaN or Infinity in output. Use `NULLIF(denominator, 0)` in all division.

## Warning (flag in task notes, continue)

- **>10% nulls in non-optional column:** Data may be incomplete. Note the null rate in `record_query_result` or `record_metric` confidence.
- **Values outside 3σ:** A metric is more than 3 standard deviations from the mean. Could be a real outlier or a data quality issue. Flag it.
- **Row count significantly below expected:** If you expected 100 rows and got 12, data may be filtered incorrectly or the source is incomplete.
- **Duplicate keys:** If a column that should be unique (account name, post ID) has duplicates, dedup or flag.

## Info (note in metadata, no action needed)

- **Schema differs from expected:** Columns renamed, types changed, or extra columns present. Note in dataset_ref caveats.
- **Date range incomplete:** Data covers 5 months when 6 were expected. Note the actual range.
- **Mixed types in column:** A column has both strings and numbers (common in scraped data). DuckDB auto_detect may cast to VARCHAR.

## How to apply

After each `duckdb_query` in ANALYZE phase:
1. Check result row count — is it what you expected?
2. Scan for nulls in key columns: `SELECT COUNT(*) FILTER (WHERE col IS NULL) FROM result`
3. Check ranges: `SELECT MIN(metric), MAX(metric) FROM result`
4. If any Critical check fails → create corrective TaskCreate, re-execute
5. If any Warning check triggers → note in TaskUpdate, continue
6. Record validation status in the VALIDATE phase task notes
