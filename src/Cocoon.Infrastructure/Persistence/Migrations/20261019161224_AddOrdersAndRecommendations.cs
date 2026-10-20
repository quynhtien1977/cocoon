using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrdersAndRecommendations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "Survey",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PreferenceId",
                table: "QuestionOption",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrderItemId",
                table: "Feedback",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "CustomerPreference",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "CustomerPreference",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Declared"); // Existing rows were chosen by the customer.

            migrationBuilder.CreateTable(
                name: "Order",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<int>(type: "integer", nullable: false),
                    Channel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(12,0)", precision: 12, scale: 0, nullable: false),
                    OrderedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Order", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Order_CustomerProfile_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "CustomerProfile",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RecommendationPlan",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Goal = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Segment = table.Column<string>(type: "jsonb", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    StartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecommendationPlan", x => x.Id);
                    table.CheckConstraint("CK_RecommendationPlan_Dates", "\"EndAt\" > \"StartAt\"");
                    table.ForeignKey(
                        name: "FK_RecommendationPlan_StaffProfile_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "StaffProfile",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrderItem",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    ProductVariantId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(12,0)", precision: 12, scale: 0, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderItem", x => x.Id);
                    table.CheckConstraint("CK_OrderItem_Quantity", "\"Quantity\" > 0");
                    table.ForeignKey(
                        name: "FK_OrderItem_Order_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Order",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderItem_ProductVariant_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariant",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Recommendation",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CustomerId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    Score = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    Breakdown = table.Column<string>(type: "jsonb", nullable: false),
                    Reasons = table.Column<string>(type: "jsonb", nullable: false),
                    PlanId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InteractedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recommendation", x => x.Id);
                    table.CheckConstraint("CK_Recommendation_Score", "\"Score\" BETWEEN 0 AND 1");
                    table.ForeignKey(
                        name: "FK_Recommendation_CustomerProfile_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "CustomerProfile",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Recommendation_Product_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Recommendation_RecommendationPlan_PlanId",
                        column: x => x.PlanId,
                        principalTable: "RecommendationPlan",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RecommendationPlanProduct",
                columns: table => new
                {
                    PlanId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecommendationPlanProduct", x => new { x.PlanId, x.ProductId });
                    table.ForeignKey(
                        name: "FK_RecommendationPlanProduct_Product_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RecommendationPlanProduct_RecommendationPlan_PlanId",
                        column: x => x.PlanId,
                        principalTable: "RecommendationPlan",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Survey_ProductId",
                table: "Survey",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOption_PreferenceId",
                table: "QuestionOption",
                column: "PreferenceId");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_OrderItemId",
                table: "Feedback",
                column: "OrderItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Order_Code",
                table: "Order",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Order_CustomerId_OrderedAt",
                table: "Order",
                columns: new[] { "CustomerId", "OrderedAt" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_OrderItem_OrderId",
                table: "OrderItem",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItem_ProductVariantId",
                table: "OrderItem",
                column: "ProductVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_Recommendation_CustomerId_ProductId",
                table: "Recommendation",
                columns: new[] { "CustomerId", "ProductId" },
                unique: true,
                filter: "\"Status\" = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_Recommendation_CustomerId_Status",
                table: "Recommendation",
                columns: new[] { "CustomerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Recommendation_PlanId",
                table: "Recommendation",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_Recommendation_ProductId",
                table: "Recommendation",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_RecommendationPlan_CreatedBy",
                table: "RecommendationPlan",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_RecommendationPlanProduct_ProductId",
                table: "RecommendationPlanProduct",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_Feedback_OrderItem_OrderItemId",
                table: "Feedback",
                column: "OrderItemId",
                principalTable: "OrderItem",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_QuestionOption_Preference_PreferenceId",
                table: "QuestionOption",
                column: "PreferenceId",
                principalTable: "Preference",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Survey_Product_ProductId",
                table: "Survey",
                column: "ProductId",
                principalTable: "Product",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Feedback_OrderItem_OrderItemId",
                table: "Feedback");

            migrationBuilder.DropForeignKey(
                name: "FK_QuestionOption_Preference_PreferenceId",
                table: "QuestionOption");

            migrationBuilder.DropForeignKey(
                name: "FK_Survey_Product_ProductId",
                table: "Survey");

            migrationBuilder.DropTable(
                name: "OrderItem");

            migrationBuilder.DropTable(
                name: "Recommendation");

            migrationBuilder.DropTable(
                name: "RecommendationPlanProduct");

            migrationBuilder.DropTable(
                name: "Order");

            migrationBuilder.DropTable(
                name: "RecommendationPlan");

            migrationBuilder.DropIndex(
                name: "IX_Survey_ProductId",
                table: "Survey");

            migrationBuilder.DropIndex(
                name: "IX_QuestionOption_PreferenceId",
                table: "QuestionOption");

            migrationBuilder.DropIndex(
                name: "IX_Feedback_OrderItemId",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "Survey");

            migrationBuilder.DropColumn(
                name: "PreferenceId",
                table: "QuestionOption");

            migrationBuilder.DropColumn(
                name: "OrderItemId",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "CustomerPreference");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "CustomerPreference");
        }
    }
}
