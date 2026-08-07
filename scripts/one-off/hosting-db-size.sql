-- hosting-db-size.sql — DB sizing snapshot for the hosting research.
-- Run via hosting-db-size.sh (psql against the compose db on 127.0.0.1:5433).

SELECT 'database_size_bytes' AS metric, pg_database_size(current_database())::text AS value
UNION ALL
SELECT 'user_count', count(*)::text FROM users
UNION ALL
SELECT 'connections', count(*)::text FROM pg_stat_activity WHERE datname = current_database()
UNION ALL
SELECT 'blks_read', blks_read::text FROM pg_stat_database WHERE datname = current_database()
UNION ALL
SELECT 'blks_written', pg_stat_get_db_blocks_fetched(oid)::text
  FROM pg_database WHERE datname = current_database();

-- top 15 relations by total size
SELECT relname, pg_total_relation_size(c.oid) AS total_bytes, n_live_tup
FROM pg_class c
JOIN pg_stat_user_tables s ON s.relid = c.oid
ORDER BY total_bytes DESC
LIMIT 15;
