SELECT count(*) AS application_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name <> '__EFMigrationsHistory';

SELECT "MigrationId", "ProductVersion" FROM "__EFMigrationsHistory";

SELECT constraint_type, count(*) AS constraint_count
FROM information_schema.table_constraints
WHERE table_schema = 'public'
GROUP BY constraint_type
ORDER BY constraint_type;

SELECT count(*) AS business_check_constraints
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype = 'c';

SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE 'CREATE UNIQUE INDEX%'
      AND indexname NOT LIKE 'PK_%'
ORDER BY tablename, indexname;
