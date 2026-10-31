-- Read-only COC-52 checks; no customer fields, passwords or tokens.
-- Baseline without user changes: 60 feedback, 36 assignments, 24 replies; 12 per state.
SELECT 'Feedback' AS entity, count(*) AS total FROM "Feedback"
UNION ALL SELECT 'FeedbackAssignment', count(*) FROM "FeedbackAssignment"
UNION ALL SELECT 'FeedbackReply', count(*) FROM "FeedbackReply";
SELECT "Status", count(*) AS total FROM "Feedback" GROUP BY "Status" ORDER BY "Status";
SELECT "Rating", count(*) AS total FROM "Feedback" GROUP BY "Rating" ORDER BY "Rating";

-- All following counts must be zero on the unmodified demo dataset.
SELECT count(*) AS invalid_purchases
FROM "Feedback" f
LEFT JOIN "OrderItem" i ON i."Id" = f."OrderItemId"
LEFT JOIN "Order" o ON o."Id" = i."OrderId"
LEFT JOIN "ProductVariant" v ON v."Id" = i."ProductVariantId"
WHERE i."Id" IS NULL OR o."Status" <> 'Completed'
   OR f."CustomerId" <> o."CustomerId" OR f."ProductId" <> v."ProductId"
   OR f."CreatedAt" < o."OrderedAt";

SELECT count(*) AS invalid_state_fields
FROM "Feedback" f
WHERE (f."Status" = 'New' AND (f."AcceptedBy" IS NOT NULL OR f."AcceptedAt" IS NOT NULL))
   OR (f."Status" <> 'New' AND (f."AcceptedBy" IS NULL OR f."AcceptedAt" IS NULL))
   OR ((f."Status" IN ('Assigned', 'Replied', 'Closed')) <> (f."AssignedStaffId" IS NOT NULL))
   OR ((f."Status" IN ('Replied', 'Closed')) <> (f."RepliedAt" IS NOT NULL))
   OR ((f."Status" = 'Closed') <> (f."ClosedAt" IS NOT NULL))
   OR f."AcceptedAt" < f."CreatedAt" OR f."RepliedAt" < f."AcceptedAt"
   OR f."ClosedAt" < f."RepliedAt" OR f."CreatedAt" > now()
   OR f."AcceptedAt" > now() OR f."RepliedAt" > now() OR f."ClosedAt" > now()
   OR length(f."Content") NOT BETWEEN 20 AND 1000 OR f."Rating" NOT BETWEEN 1 AND 5;

SELECT count(*) AS invalid_assignment_history
FROM "Feedback" f
WHERE (SELECT count(*) FROM "FeedbackAssignment" a WHERE a."FeedbackId" = f."Id")
      <> CASE WHEN f."AssignedStaffId" IS NULL THEN 0 ELSE 1 END
   OR EXISTS (SELECT 1 FROM "FeedbackAssignment" a
              JOIN "Account" staff ON staff."Id" = a."StaffId"
              JOIN "Account" manager ON manager."Id" = a."AssignedBy"
              WHERE a."FeedbackId" = f."Id" AND (
                  a."StaffId" <> f."AssignedStaffId" OR a."AssignedBy" <> f."AcceptedBy"
                  OR staff."Role" <> 'Staff' OR manager."Role" <> 'Manager'
                  OR a."AssignedAt" < f."AcceptedAt" OR a."AssignedAt" > now()
                  OR a."AssignedAt" > f."RepliedAt"));

SELECT count(*) AS invalid_replies
FROM "Feedback" f
WHERE (SELECT count(*) FROM "FeedbackReply" r WHERE r."FeedbackId" = f."Id")
      <> CASE WHEN f."RepliedAt" IS NULL THEN 0 ELSE 1 END
   OR EXISTS (SELECT 1 FROM "FeedbackReply" r WHERE r."FeedbackId" = f."Id" AND (
                  r."StaffId" <> f."AssignedStaffId" OR r."CreatedAt" <> f."RepliedAt"
                  OR length(r."Content") NOT BETWEEN 10 AND 500));
