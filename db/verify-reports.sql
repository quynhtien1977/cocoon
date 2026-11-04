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

-- Match ReportPeriod: reject reversed/equal explicit bounds before emitting results.
SELECT NULLIF(:'report_from', '')::timestamptz >= NULLIF(:'report_to', '')::timestamptz
    IS TRUE AS invalid_report_period
\gset
\if :invalid_report_period
DO $$ BEGIN RAISE EXCEPTION 'report_from must precede report_to'; END $$;
\endif

-- Result set 01: customers_age.
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

-- Result set 02: customers_gender.
-- Current gender composition; null/blank labels are one group.
SELECT CASE WHEN c."Gender" IS NULL OR btrim(c."Gender") = '' THEN 'Chưa cung cấp' ELSE c."Gender" END AS gender, count(*) AS customers
FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId"
WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted"
GROUP BY 1 ORDER BY 1;

-- Result set 03: customers_preferences.
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

-- Result set 04: overview.
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

-- Result set 05: ratings_distribution.
-- Rating distribution must sum to overview.ratingCount for the same interval.
WITH filtered AS (
    SELECT f.* FROM "Feedback" f
    WHERE (NULLIF(:'report_from', '') IS NULL OR f."CreatedAt" >= NULLIF(:'report_from', '')::timestamptz)
      AND f."CreatedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
)
SELECT n.rating, count(f."Id") AS feedback_count
FROM generate_series(1,5) AS n(rating) LEFT JOIN filtered f ON f."Rating" = n.rating
GROUP BY n.rating ORDER BY n.rating;

-- Result set 06: ratings_by_month.
-- Monthly negative rate uses 0–1 fractions, not percentages.
SELECT to_char(f."CreatedAt", 'YYYY-MM') AS month, count(*) AS feedback_count,
    avg(f."Rating") AS avg_rating, count(*) FILTER (WHERE f."Rating" <= 2)::numeric / count(*) AS low_rating_rate
FROM "Feedback" f
WHERE (NULLIF(:'report_from', '') IS NULL OR f."CreatedAt" >= NULLIF(:'report_from', '')::timestamptz)
  AND f."CreatedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
GROUP BY 1 ORDER BY 1;

-- Result set 07: purchases_categories.
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

-- Result set 08: ratings_by_product.
-- Catalog soft deletion does not discard feedback history.
SELECT p."Id" AS product_id, p."Name" AS product, count(*) AS feedback_count,
    avg(f."Rating") AS avg_rating
FROM "Feedback" f JOIN "Product" p ON p."Id" = f."ProductId"
WHERE (NULLIF(:'report_from', '') IS NULL OR f."CreatedAt" >= NULLIF(:'report_from', '')::timestamptz)
  AND f."CreatedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
GROUP BY p."Id", p."Name" ORDER BY product_id;

-- Result set 09: ratings_by_category.
SELECT c."Id" AS category_id, c."Name" AS category, count(*) AS feedback_count,
    avg(f."Rating") AS avg_rating
FROM "Feedback" f JOIN "Product" p ON p."Id" = f."ProductId"
JOIN "Category" c ON c."Id" = p."CategoryId"
WHERE (NULLIF(:'report_from', '') IS NULL OR f."CreatedAt" >= NULLIF(:'report_from', '')::timestamptz)
  AND f."CreatedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
GROUP BY c."Id", c."Name" ORDER BY category_id;

-- Result set 10: recommendations_summary.
-- Historical generated rows retain every status and customer/catalog history.
-- Coverage alone intersects that cohort with currently eligible, consenting customers.
WITH cohort AS (
    SELECT r.* FROM "Recommendation" r
    WHERE (NULLIF(:'report_from', '') IS NULL OR r."GeneratedAt" >= NULLIF(:'report_from', '')::timestamptz)
      AND r."GeneratedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
), eligible AS (
    SELECT c."AccountId" FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId"
    WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted" AND c."ConsentPersonalData"
), summary AS (
    SELECT count(*) AS recommendation_count,
        count(*) FILTER (WHERE "Status" = 'Clicked') AS clicks,
        count(*) FILTER (WHERE "Status" = 'Dismissed') AS dismissals,
        max("GeneratedAt") AS last_built_at
    FROM cohort
), coverage AS (
    SELECT count(*) AS eligible_customers,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM cohort r WHERE r."CustomerId" = e."AccountId")) AS covered_customers
    FROM eligible e
)
SELECT c.eligible_customers, c.covered_customers, s.recommendation_count, s.clicks, s.dismissals,
    COALESCE(round(c.covered_customers::numeric / NULLIF(c.eligible_customers, 0), 6), 0) AS coverage,
    COALESCE(round(s.clicks::numeric / NULLIF(s.recommendation_count, 0), 6), 0) AS click_rate,
    COALESCE(round(s.dismissals::numeric / NULLIF(s.recommendation_count, 0), 6), 0) AS dismiss_rate,
    (SELECT count(*) FROM "RecommendationPlan" p WHERE p."Status" = 'Active'
        AND p."StartAt" <= CURRENT_TIMESTAMP AND p."EndAt" > CURRENT_TIMESTAMP) AS active_plans,
    s.last_built_at
FROM summary s CROSS JOIN coverage c;

-- Result set 11: recommendations_top_products.
-- Counts use the latest persisted status; a later dismiss replaces an earlier click.
WITH grouped AS (
    SELECT p."Id" AS id, p."Name" AS name, count(*) AS recommendation_count,
        count(*) FILTER (WHERE r."Status" = 'Clicked') AS clicks,
        count(*) FILTER (WHERE r."Status" = 'Dismissed') AS dismissals
    FROM "Recommendation" r JOIN "Product" p ON p."Id" = r."ProductId"
    WHERE (NULLIF(:'report_from', '') IS NULL OR r."GeneratedAt" >= NULLIF(:'report_from', '')::timestamptz)
      AND r."GeneratedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
    GROUP BY p."Id", p."Name"
)
SELECT id, name, recommendation_count, clicks, dismissals,
    round(clicks::numeric / recommendation_count, 6) AS click_rate,
    round(dismissals::numeric / recommendation_count, 6) AS dismiss_rate
FROM grouped ORDER BY clicks DESC, recommendation_count DESC, id LIMIT 10;

-- Result set 12: recommendations_by_plan.
-- A null PlanId is organic; Ended plans and deleted customer/catalog history remain included.
WITH grouped AS (
    SELECT r."PlanId" AS plan_id, p."Name" AS plan_name,
        count(DISTINCT r."CustomerId") AS customer_count, count(*) AS recommendation_count,
        count(*) FILTER (WHERE r."Status" = 'Clicked') AS clicks,
        count(*) FILTER (WHERE r."Status" = 'Dismissed') AS dismissals
    FROM "Recommendation" r LEFT JOIN "RecommendationPlan" p ON p."Id" = r."PlanId"
    WHERE (NULLIF(:'report_from', '') IS NULL OR r."GeneratedAt" >= NULLIF(:'report_from', '')::timestamptz)
      AND r."GeneratedAt" < COALESCE(NULLIF(:'report_to', '')::timestamptz, CURRENT_TIMESTAMP)
    GROUP BY r."PlanId", p."Name"
)
SELECT plan_id, plan_name, customer_count, recommendation_count, clicks, dismissals,
    round(clicks::numeric / recommendation_count, 6) AS click_rate,
    round(dismissals::numeric / recommendation_count, 6) AS dismiss_rate
FROM grouped ORDER BY plan_id NULLS FIRST;

COMMIT;
