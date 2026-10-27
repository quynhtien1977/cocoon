-- Read-only checks for COC-50. Run after seed on an empty LOCAL verification database.
-- Does not select password hashes, tokens, personal fields or connection settings.
SELECT 'Account' AS entity, count(*) AS total FROM "Account"
UNION ALL SELECT 'StaffProfile', count(*) FROM "StaffProfile"
UNION ALL SELECT 'CustomerProfile', count(*) FROM "CustomerProfile"
UNION ALL SELECT 'Preference', count(*) FROM "Preference"
UNION ALL SELECT 'CustomerPreference', count(*) FROM "CustomerPreference"
UNION ALL SELECT 'Category', count(*) FROM "Category"
UNION ALL SELECT 'Product', count(*) FROM "Product"
UNION ALL SELECT 'ProductVariant', count(*) FROM "ProductVariant"
UNION ALL SELECT 'ProductPreference', count(*) FROM "ProductPreference"
UNION ALL SELECT 'Order', count(*) FROM "Order"
UNION ALL SELECT 'OrderItem', count(*) FROM "OrderItem"
ORDER BY entity;

SELECT "Role", count(*) AS total FROM "Account" GROUP BY "Role" ORDER BY "Role";
SELECT count(*) FILTER (WHERE a."IsActive" AND NOT a."IsDeleted") AS active_customers,
       count(*) FILTER (WHERE NOT a."IsActive") AS locked_customers,
       count(*) FILTER (WHERE a."IsDeleted") AS deleted_customers,
       count(*) FILTER (WHERE c."DateOfBirth" IS NULL) AS missing_dob,
       count(*) FILTER (WHERE NOT c."ConsentPersonalData") AS no_consent
FROM "CustomerProfile" c JOIN "Account" a ON a."Id" = c."AccountId";

SELECT "Status", count(*) AS total FROM "Product" GROUP BY "Status" ORDER BY "Status";
SELECT "Channel", "Status", count(*) AS total FROM "Order" GROUP BY "Channel", "Status" ORDER BY "Channel", "Status";
SELECT count(DISTINCT date_trunc('month', "OrderedAt" AT TIME ZONE 'UTC')) AS order_months FROM "Order";

-- Expect zero inconsistent totals / non-positive lines / purchases of non-Active products.
SELECT count(*) AS incorrect_order_totals
FROM "Order" o
WHERE o."TotalAmount" <> (SELECT coalesce(sum(i."Quantity" * i."UnitPrice"), 0) FROM "OrderItem" i WHERE i."OrderId" = o."Id");
SELECT count(*) AS invalid_order_lines
FROM "OrderItem" i JOIN "ProductVariant" v ON v."Id" = i."ProductVariantId"
JOIN "Product" p ON p."Id" = v."ProductId"
WHERE i."Quantity" <= 0 OR i."UnitPrice" <= 0 OR p."Status" <> 'Active';

-- Expect exactly 70% on the unmodified demo dataset.
SELECT round(100.0 * count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM "ProductPreference" pp JOIN "CustomerPreference" cp ON cp."PreferenceId" = pp."PreferenceId"
    WHERE pp."ProductId" = v."ProductId" AND cp."CustomerId" = o."CustomerId"
)) / nullif(count(*), 0), 2) AS preference_match_percent
FROM "OrderItem" i JOIN "Order" o ON o."Id" = i."OrderId"
JOIN "ProductVariant" v ON v."Id" = i."ProductVariantId";

-- Repeated co-purchases by >=3 distinct customers, ready for later analytical views.
SELECT va."ProductId" AS product_a, vb."ProductId" AS product_b,
       count(DISTINCT o."CustomerId") AS customers
FROM "Order" o JOIN "OrderItem" a ON a."OrderId" = o."Id"
JOIN "OrderItem" b ON b."OrderId" = o."Id" AND b."Id" > a."Id"
JOIN "ProductVariant" va ON va."Id" = a."ProductVariantId"
JOIN "ProductVariant" vb ON vb."Id" = b."ProductVariantId"
WHERE o."Status" = 'Completed' AND va."ProductId" <> vb."ProductId"
GROUP BY va."ProductId", vb."ProductId"
HAVING count(DISTINCT o."CustomerId") >= 3
ORDER BY customers DESC, product_a, product_b;
