-- COC-42: read-only reconciliation. All four *_mismatches must be zero.
-- Refresh mv_product_copurchase after changing orders and before running this check.
BEGIN READ ONLY;

SELECT (SELECT COUNT(*) FROM public.mv_product_copurchase) AS copurchase_pairs,
       (SELECT COUNT(*) FROM public.v_customer_category_affinity) AS customer_category_rows,
       (SELECT COUNT(*) FROM public.v_product_rating) AS rated_products,
       (SELECT COUNT(*) FROM public.v_customer_low_rated_category) AS low_rated_customer_categories;

WITH purchases AS (
    SELECT DISTINCT o."CustomerId", v."ProductId"
    FROM public."Order" o
    JOIN public."OrderItem" i ON i."OrderId" = o."Id"
    JOIN public."ProductVariant" v ON v."Id" = i."ProductVariantId"
    WHERE o."Status" = 'Completed' AND o."OrderedAt" <= CURRENT_TIMESTAMP
), expected AS (
    SELECT a."ProductId" AS "ProductA", b."ProductId" AS "ProductB", COUNT(*) AS "BothCount",
           (SELECT COUNT(*) FROM purchases n WHERE n."ProductId" = a."ProductId") AS "ACount",
           COUNT(*)::numeric / (SELECT COUNT(*) FROM purchases n WHERE n."ProductId" = a."ProductId") AS "Confidence"
    FROM purchases a JOIN purchases b ON a."CustomerId" = b."CustomerId" AND a."ProductId" <> b."ProductId"
    GROUP BY a."ProductId", b."ProductId" HAVING COUNT(*) >= 3
), delta AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM public.mv_product_copurchase)
    UNION ALL
    (SELECT * FROM public.mv_product_copurchase EXCEPT SELECT * FROM expected)
)
SELECT COUNT(*) AS copurchase_mismatches FROM delta;

WITH quantities AS (
    SELECT o."CustomerId", p."CategoryId", SUM(i."Quantity"::numeric) AS quantity
    FROM public."Order" o
    JOIN public."OrderItem" i ON i."OrderId" = o."Id"
    JOIN public."ProductVariant" v ON v."Id" = i."ProductVariantId"
    JOIN public."Product" p ON p."Id" = v."ProductId"
    JOIN public."CustomerProfile" c ON c."AccountId" = o."CustomerId"
    JOIN public."Account" a ON a."Id" = c."AccountId"
    WHERE o."Status" = 'Completed' AND o."OrderedAt" <= CURRENT_TIMESTAMP
        AND o."OrderedAt" >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '12 months') AT TIME ZONE 'UTC'
        AND c."ConsentPersonalData" AND a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted"
    GROUP BY o."CustomerId", p."CategoryId"
), expected AS (
    SELECT q."CustomerId", q."CategoryId", q.quantity /
        (SELECT SUM(n.quantity) FROM quantities n WHERE n."CustomerId" = q."CustomerId") AS "Share"
    FROM quantities q
), delta AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM public.v_customer_category_affinity)
    UNION ALL
    (SELECT * FROM public.v_customer_category_affinity EXCEPT SELECT * FROM expected)
)
SELECT COUNT(*) AS affinity_mismatches FROM delta;

WITH expected AS (
    SELECT "ProductId", AVG("Rating"::numeric) AS "AvgRating", COUNT(*) AS "FeedbackCount"
    FROM public."Feedback" GROUP BY "ProductId"
), delta AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM public.v_product_rating)
    UNION ALL
    (SELECT * FROM public.v_product_rating EXCEPT SELECT * FROM expected)
)
SELECT COUNT(*) AS product_rating_mismatches FROM delta;

WITH expected AS (
    SELECT f."CustomerId", p."CategoryId", AVG(f."Rating"::numeric) AS "AvgRating", COUNT(*) AS "FeedbackCount"
    FROM public."Feedback" f
    JOIN public."Product" p ON p."Id" = f."ProductId"
    WHERE EXISTS (
        SELECT 1 FROM public."CustomerProfile" c JOIN public."Account" a ON a."Id" = c."AccountId"
        WHERE c."AccountId" = f."CustomerId" AND c."ConsentPersonalData"
            AND a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted"
    )
    GROUP BY f."CustomerId", p."CategoryId" HAVING AVG(f."Rating"::numeric) <= 2
), delta AS (
    (SELECT * FROM expected EXCEPT SELECT * FROM public.v_customer_low_rated_category)
    UNION ALL
    (SELECT * FROM public.v_customer_low_rated_category EXCEPT SELECT * FROM expected)
)
SELECT COUNT(*) AS low_rated_category_mismatches FROM delta;

COMMIT;
