-- COC-55 read-only checks on the unmodified demo dataset. No customer fields or secrets.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT 'Survey' AS entity, count(*) AS total FROM "Survey" WHERE "Id" IN (5500001,5500002,5500003)
UNION ALL SELECT 'SurveyQuestion', count(*) FROM "SurveyQuestion" WHERE "SurveyId" IN (5500001,5500002,5500003)
UNION ALL SELECT 'QuestionOption', count(*) FROM "QuestionOption" o JOIN "SurveyQuestion" q ON q."Id"=o."QuestionId" WHERE q."SurveyId" IN (5500001,5500002,5500003)
UNION ALL SELECT 'SurveyRecipient', count(*) FROM "SurveyRecipient" WHERE "SurveyId" IN (5500001,5500002,5500003)
UNION ALL SELECT 'SurveyResponse', count(*) FROM "SurveyResponse" WHERE "SurveyId" IN (5500001,5500002,5500003)
UNION ALL SELECT 'SurveyAnswer', count(*) FROM "SurveyAnswer" a JOIN "SurveyResponse" r ON r."Id"=a."ResponseId" WHERE r."SurveyId" IN (5500001,5500002,5500003)
UNION ALL SELECT 'Notification', count(*) FROM "Notification" WHERE "RefType"='Survey' AND "RefId" IN (5500001,5500002,5500003)
UNION ALL SELECT 'RecommendationPlan', count(*) FROM "RecommendationPlan" WHERE "Id" IN (5500011,5500012,5500013)
UNION ALL SELECT 'RecommendationPlanProduct', count(*) FROM "RecommendationPlanProduct" WHERE "PlanId" IN (5500011,5500012,5500013);

SELECT s."Id",s."Status",s."Purpose",count(DISTINCT r."Id") AS sent,count(DISTINCT p."Id") AS submitted
FROM "Survey" s LEFT JOIN "SurveyRecipient" r ON r."SurveyId"=s."Id"
LEFT JOIN "SurveyResponse" p ON p."SurveyId"=s."Id"
WHERE s."Id" IN (5500001,5500002,5500003) GROUP BY s."Id" ORDER BY s."Id";

-- Every following invalid_* count must be zero before manual demo edits.
SELECT count(*) AS invalid_survey_setup FROM "Survey" s
JOIN "Account" manager ON manager."Id"=s."CreatedBy"
LEFT JOIN "Product" p ON p."Id"=s."ProductId"
WHERE s."Id" IN (5500001,5500002,5500003) AND (
 manager."Role"<>'Manager' OR s."IsDeleted" OR
 (SELECT count(*) FROM "SurveyQuestion" q WHERE q."SurveyId"=s."Id")<>4 OR
 (s."Purpose"='NewProduct' AND (p."Id" IS NULL OR p."Status"<>'Upcoming' OR p."IsDeleted")) OR
 (s."Status"='Draft' AND EXISTS (SELECT 1 FROM "SurveyRecipient" r WHERE r."SurveyId"=s."Id")));

SELECT count(*) AS invalid_submissions FROM "SurveyResponse" p
JOIN "Survey" s ON s."Id"=p."SurveyId"
JOIN "Account" c ON c."Id"=p."CustomerId"
LEFT JOIN "SurveyRecipient" r ON r."SurveyId"=p."SurveyId" AND r."CustomerId"=p."CustomerId"
WHERE s."Id" IN (5500001,5500002,5500003) AND (
 r."Id" IS NULL OR r."Status"<>'Done' OR r."CompletedAt" IS DISTINCT FROM p."SubmittedAt" OR
 c."Role"<>'Customer' OR NOT c."IsActive" OR c."IsDeleted" OR
 s."Status"='Draft' OR s."OpenAt" IS NULL OR s."CloseAt" IS NULL OR
 p."SubmittedAt"<s."OpenAt" OR p."SubmittedAt">=s."CloseAt" OR
 p."SubmittedAt"<r."SentAt" OR p."SubmittedAt">now());

SELECT count(*) AS invalid_recipient_states FROM "SurveyRecipient" r
LEFT JOIN "SurveyResponse" p ON p."SurveyId"=r."SurveyId" AND p."CustomerId"=r."CustomerId"
WHERE r."SurveyId" IN (5500001,5500002,5500003) AND (
 (r."Status"='Done')<>(p."Id" IS NOT NULL) OR r."CompletedAt" IS DISTINCT FROM p."SubmittedAt");

SELECT count(*) AS invalid_answer_values FROM "SurveyAnswer" a
JOIN "SurveyResponse" p ON p."Id"=a."ResponseId"
JOIN "SurveyQuestion" q ON q."Id"=a."QuestionId"
LEFT JOIN "QuestionOption" o ON o."Id"=a."OptionId"
WHERE p."SurveyId" IN (5500001,5500002,5500003) AND (
 q."SurveyId"<>p."SurveyId" OR
 (q."Type" IN ('SingleChoice','MultiChoice') AND (o."Id" IS NULL OR o."QuestionId"<>q."Id" OR a."NumericValue" IS NOT NULL OR a."TextValue" IS NOT NULL)) OR
 (q."Type"='Rating' AND (a."OptionId" IS NOT NULL OR a."TextValue" IS NOT NULL OR a."NumericValue" IS NULL OR a."NumericValue" NOT BETWEEN 1 AND 5 OR trunc(a."NumericValue")<>a."NumericValue")) OR
 (q."Type"='ShortText' AND (a."OptionId" IS NOT NULL OR a."NumericValue" IS NOT NULL OR length(trim(coalesce(a."TextValue",''))) NOT BETWEEN 1 AND 1000)));

SELECT count(*) AS invalid_answer_counts FROM (
 SELECT p."Id",q."Id" FROM "SurveyResponse" p JOIN "SurveyQuestion" q ON q."SurveyId"=p."SurveyId"
 LEFT JOIN "SurveyAnswer" a ON a."ResponseId"=p."Id" AND a."QuestionId"=q."Id"
 WHERE p."SurveyId" IN (5500001,5500002,5500003)
 GROUP BY p."Id",q."Id",q."Type"
 HAVING count(a."Id")<>CASE WHEN q."Type"='MultiChoice' THEN 2 ELSE 1 END
 OR (q."Type"='MultiChoice' AND count(DISTINCT a."OptionId")<>2)
) wrong;

SELECT count(*) AS invalid_notifications FROM "SurveyRecipient" r
WHERE r."SurveyId" IN (5500001,5500002,5500003) AND
 (SELECT count(*) FROM "Notification" n WHERE n."RefType"='Survey' AND n."RefId"=r."SurveyId"
  AND n."AccountId"=r."CustomerId" AND n."CreatedAt"=r."SentAt" AND n."IsRead"=(r."Status"='Done'))<>1;

SELECT count(*) AS invalid_survey_preferences FROM "CustomerPreference" cp
JOIN "CustomerProfile" c ON c."AccountId"=cp."CustomerId"
WHERE cp."Source"='Survey' AND (NOT c."ConsentPersonalData" OR NOT EXISTS (
 SELECT 1 FROM "SurveyResponse" r JOIN "SurveyAnswer" a ON a."ResponseId"=r."Id"
 JOIN "QuestionOption" o ON o."Id"=a."OptionId"
 WHERE r."CustomerId"=cp."CustomerId" AND o."PreferenceId"=cp."PreferenceId"));

SELECT count(*) AS invalid_plans FROM "RecommendationPlan" p
JOIN "Account" manager ON manager."Id"=p."CreatedBy"
WHERE p."Id" IN (5500011,5500012,5500013) AND (
 manager."Role"<>'Manager' OR p."EndAt"<=p."StartAt" OR jsonb_typeof(p."Segment")<>'object' OR
 (p."Status"='Active' AND (p."StartAt">now() OR p."EndAt"<=now())) OR
 (p."Status"='Ended' AND p."EndAt">now()) OR
 NOT EXISTS (SELECT 1 FROM "RecommendationPlanProduct" pp WHERE pp."PlanId"=p."Id") OR
 EXISTS (SELECT 1 FROM "RecommendationPlanProduct" pp JOIN "Product" sp ON sp."Id"=pp."ProductId"
         WHERE pp."PlanId"=p."Id" AND (sp."IsDeleted" OR sp."Status"<>'Active')));

SELECT count(*) AS customer01_pending_open_surveys FROM "SurveyRecipient" r
JOIN "Survey" s ON s."Id"=r."SurveyId" JOIN "Account" a ON a."Id"=r."CustomerId"
WHERE a."Email"='customer01@cocoon.demo' AND r."Status"='NotDone' AND NOT s."IsDeleted"
 AND s."Status"='Open' AND s."OpenAt"<=now() AND s."CloseAt">now();
SELECT "Status",count(*) AS total FROM "RecommendationPlan" WHERE "Id" IN (5500011,5500012,5500013) GROUP BY "Status" ORDER BY "Status";
SELECT "Source",count(*) AS total FROM "CustomerPreference" GROUP BY "Source" ORDER BY "Source";
COMMIT;
