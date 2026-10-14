SELECT current_database() AS database_name,
       count(*) AS public_tables_before_migration
FROM information_schema.tables
WHERE table_schema = 'public';
