\set ON_ERROR_STOP on
\if :{?report_from}
\else
\set report_from ''
\endif
\if :{?report_to}
\else
\set report_to ''
\endif

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';

-- Current active customer age buckets; compare with customers/age.items.
WITH active AS (
    SELECT c.*, EXTRACT(YEAR FROM age(CURRENT_DATE, c."DateOfBirth")) AS age
    FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId"
    WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted"
), counts AS (
    SELECT CASE WHEN "DateOfBirth" IS NULL THEN 5 WHEN age < 18 THEN 0
        WHEN age < 25 THEN 1 WHEN age < 35 THEN 2 WHEN age < 45 THEN 3 ELSE 4 END AS bucket,
        count(*) AS customers FROM active GROUP BY 1
), labels(bucket, label) AS (VALUES (0,'<18'),(1,'18–24'),(2,'25–34'),(3,'35–44'),(4,'≥45'),(5,'Chưa cung cấp'))
SELECT l.label AS age_group, COALESCE(c.customers, 0) AS customers,
    (SELECT count(*) FROM active) AS total_customers
FROM labels l LEFT JOIN counts c ON c.bucket = l.bucket ORDER BY l.bucket;

-- Current gender composition; null/blank labels are one group.
SELECT CASE WHEN c."Gender" IS NULL OR btrim(c."Gender") = '' THEN 'Chưa cung cấp' ELSE c."Gender" END AS gender, count(*) AS customers
FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId"
WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted"
GROUP BY 1 ORDER BY 1;

-- Preferences: denominator includes consenting customers without any selection.
WITH consenting AS (
    SELECT c."AccountId" FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId"
    WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted" AND c."ConsentPersonalData"
)
SELECT p."Id" AS preference_id, p."Name" AS preference, count(*) AS customers,
    (SELECT count(*) FROM consenting) AS consenting_customers,
    round(100.0 * count(*) / NULLIF((SELECT count(*) FROM consenting), 0), 2) AS percentage
FROM consenting c JOIN "CustomerPreference" cp ON cp."CustomerId" = c."AccountId"
JOIN "Preference" p ON p."Id" = cp."PreferenceId"
GROUP BY p."Id", p."Name" ORDER BY customers DESC, preference_id;

-- Overview: snapshots are independent of the selected event period.
WITH bounds AS (
    SELECT NULLIF(:'report_from', '')::timestamptz AS start_at,
        COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP) AS end_at
), active AS (
    SELECT a."CreatedAt" FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId"
    WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted"
), feedback AS (
    SELECT f.* FROM "Feedback" f CROSS JOIN bounds b
    WHERE (b.start_at IS NULL OR f."CreatedAt" >= b.start_at) AND f."CreatedAt" < b.end_at
)
SELECT (SELECT count(*) FROM active) AS total_customers,
    (SELECT count(*) FROM active WHERE "CreatedAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days' AND "CreatedAt" < CURRENT_TIMESTAMP) AS new_customers_30d,
    (SELECT count(*) FROM active WHERE "CreatedAt" >= date_trunc('month', CURRENT_TIMESTAMP) AND "CreatedAt" < CURRENT_TIMESTAMP) AS new_customers_this_month,
    (SELECT count(*) FROM feedback WHERE "Status" = 'New') AS new_feedback,
    (SELECT avg("Rating") FROM feedback) AS avg_rating,
    (SELECT count(*) FROM feedback) AS rating_count,
    (SELECT count(*) FROM "Survey" WHERE NOT "IsDeleted" AND "Status" = 'Open'
        AND ("OpenAt" IS NULL OR "OpenAt" <= CURRENT_TIMESTAMP) AND ("CloseAt" IS NULL OR "CloseAt" > CURRENT_TIMESTAMP)) AS open_surveys,
    (SELECT count(*) FROM "SurveyResponse" r CROSS JOIN bounds b
        WHERE (b.start_at IS NULL OR r."SubmittedAt" >= b.start_at) AND r."SubmittedAt" < b.end_at) AS completed_responses;

-- Rating distribution must sum to overview.ratingCount for the same interval.
WITH filtered AS (
    SELECT f.* FROM "Feedback" f
    WHERE (NULLIF(:'report_from', '') IS NULL OR f."CreatedAt" >= NULLIF(:'report_from', '')::timestamptz)
      AND f."CreatedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
)
SELECT n.rating, count(f."Id") AS feedback_count
FROM generate_series(1,5) AS n(rating) LEFT JOIN filtered f ON f."Rating" = n.rating
GROUP BY n.rating ORDER BY n.rating;

-- Monthly negative rate uses 0–1 fractions, not percentages.
SELECT to_char(f."CreatedAt", 'YYYY-MM') AS month, count(*) AS feedback_count,
    avg(f."Rating") AS avg_rating, count(*) FILTER (WHERE f."Rating" <= 2)::numeric / count(*) AS low_rating_rate
FROM "Feedback" f
WHERE (NULLIF(:'report_from', '') IS NULL OR f."CreatedAt" >= NULLIF(:'report_from', '')::timestamptz)
  AND f."CreatedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
GROUP BY 1 ORDER BY 1;

-- Completed purchase revenue uses historical line prices and retains deleted profiles/catalog rows.
WITH lines AS (
    SELECT category."Id", category."Name", o."Id" AS order_id, i."Quantity", i."UnitPrice",
        CASE WHEN c."DateOfBirth" IS NULL THEN 5
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, c."DateOfBirth")) < 18 THEN 0
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, c."DateOfBirth")) < 25 THEN 1
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, c."DateOfBirth")) < 35 THEN 2
            WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, c."DateOfBirth")) < 45 THEN 3 ELSE 4 END AS bucket
    FROM "Order" o JOIN "OrderItem" i ON i."OrderId" = o."Id"
    JOIN "ProductVariant" v ON v."Id" = i."ProductVariantId"
    JOIN "Product" p ON p."Id" = v."ProductId" JOIN "Category" category ON category."Id" = p."CategoryId"
    JOIN "CustomerProfile" c ON c."AccountId" = o."CustomerId"
    WHERE o."Status" = 'Completed'
      AND (NULLIF(:'report_from', '') IS NULL OR o."OrderedAt" >= NULLIF(:'report_from', '')::timestamptz)
      AND o."OrderedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
)
SELECT "Id" AS category_id, "Name" AS category, bucket AS age_bucket,
    sum("Quantity" * "UnitPrice") AS revenue, sum("Quantity"::bigint) AS quantity, count(DISTINCT order_id) AS order_count
FROM lines GROUP BY "Id", "Name", bucket ORDER BY category_id, bucket;

COMMIT;
