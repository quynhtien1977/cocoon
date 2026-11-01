using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAnalyticsViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL")
                throw new NotSupportedException("COC-42 analytics views require PostgreSQL.");

            // Spec 5.5. Raw SQL objects remain in the EF migration history without changing the entity model.
            // https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing#arbitrary-changes-via-raw-sql
            migrationBuilder.Sql("""
                CREATE MATERIALIZED VIEW public.mv_product_copurchase AS
                WITH purchases AS (
                    SELECT DISTINCT o."CustomerId", v."ProductId"
                    FROM public."Order" o
                    JOIN public."OrderItem" i ON i."OrderId" = o."Id"
                    JOIN public."ProductVariant" v ON v."Id" = i."ProductVariantId"
                    WHERE o."Status" = 'Completed' AND o."OrderedAt" <= CURRENT_TIMESTAMP
                ), buyers AS (
                    SELECT "ProductId", COUNT(*) AS "ACount"
                    FROM purchases GROUP BY "ProductId"
                )
                SELECT a."ProductId" AS "ProductA", b."ProductId" AS "ProductB",
                       COUNT(*) AS "BothCount", n."ACount",
                       COUNT(*)::numeric / n."ACount" AS "Confidence"
                FROM purchases a
                JOIN purchases b ON b."CustomerId" = a."CustomerId" AND b."ProductId" <> a."ProductId"
                JOIN buyers n ON n."ProductId" = a."ProductId"
                GROUP BY a."ProductId", b."ProductId", n."ACount"
                HAVING COUNT(*) >= 3
                WITH DATA;

                CREATE UNIQUE INDEX "IX_mv_product_copurchase_ProductA_ProductB"
                    ON public.mv_product_copurchase ("ProductA", "ProductB");

                CREATE VIEW public.v_customer_category_affinity AS
                SELECT o."CustomerId", p."CategoryId",
                       SUM(i."Quantity"::numeric) /
                           SUM(SUM(i."Quantity"::numeric)) OVER (PARTITION BY o."CustomerId") AS "Share"
                FROM public."Order" o
                JOIN public."OrderItem" i ON i."OrderId" = o."Id"
                JOIN public."ProductVariant" v ON v."Id" = i."ProductVariantId"
                JOIN public."Product" p ON p."Id" = v."ProductId"
                JOIN public."CustomerProfile" c ON c."AccountId" = o."CustomerId"
                JOIN public."Account" a ON a."Id" = c."AccountId"
                WHERE o."Status" = 'Completed' AND o."OrderedAt" <= CURRENT_TIMESTAMP
                    AND o."OrderedAt" >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '12 months') AT TIME ZONE 'UTC'
                    AND a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted" AND c."ConsentPersonalData"
                GROUP BY o."CustomerId", p."CategoryId";

                CREATE VIEW public.v_product_rating AS
                SELECT f."ProductId", AVG(f."Rating"::numeric) AS "AvgRating", COUNT(*) AS "FeedbackCount"
                FROM public."Feedback" f
                GROUP BY f."ProductId";

                CREATE VIEW public.v_customer_low_rated_category AS
                SELECT f."CustomerId", p."CategoryId", AVG(f."Rating"::numeric) AS "AvgRating",
                       COUNT(*) AS "FeedbackCount"
                FROM public."Feedback" f
                JOIN public."Product" p ON p."Id" = f."ProductId"
                JOIN public."CustomerProfile" c ON c."AccountId" = f."CustomerId"
                JOIN public."Account" a ON a."Id" = c."AccountId"
                WHERE a."Role" = 'Customer' AND a."IsActive" AND NOT a."IsDeleted" AND c."ConsentPersonalData"
                GROUP BY f."CustomerId", p."CategoryId"
                HAVING AVG(f."Rating"::numeric) <= 2;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            if (ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL")
                throw new NotSupportedException("COC-42 analytics views require PostgreSQL.");

            migrationBuilder.Sql("""
                DROP VIEW public.v_customer_low_rated_category;
                DROP VIEW public.v_product_rating;
                DROP VIEW public.v_customer_category_affinity;
                DROP MATERIALIZED VIEW public.mv_product_copurchase;
                """);
        }
    }
}
