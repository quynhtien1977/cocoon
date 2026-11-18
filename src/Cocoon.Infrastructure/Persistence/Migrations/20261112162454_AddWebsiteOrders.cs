using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWebsiteOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "Order",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Order",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                table: "Order",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConfirmedBy",
                table: "Order",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddress",
                table: "Order",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Order_ConfirmedBy",
                table: "Order",
                column: "ConfirmedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Order_Status_OrderedAt",
                table: "Order",
                columns: new[] { "Status", "OrderedAt" },
                descending: new[] { false, true });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Confirmed",
                table: "Order",
                sql: "(\"ConfirmedAt\" IS NULL) = (\"ConfirmedBy\" IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_Order_Account_ConfirmedBy",
                table: "Order",
                column: "ConfirmedBy",
                principalTable: "Account",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Seeded and imported orders were completed when placed; give them a completion time so every Completed
            // order has one. Cancelled and returned rows stay without timestamps, which were never recorded.
            migrationBuilder.Sql("UPDATE \"Order\" SET \"CompletedAt\" = \"OrderedAt\" WHERE \"Status\" = 'Completed' AND \"CompletedAt\" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Order_Account_ConfirmedBy",
                table: "Order");

            migrationBuilder.DropIndex(
                name: "IX_Order_ConfirmedBy",
                table: "Order");

            migrationBuilder.DropIndex(
                name: "IX_Order_Status_OrderedAt",
                table: "Order");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Confirmed",
                table: "Order");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "Order");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Order");

            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "Order");

            migrationBuilder.DropColumn(
                name: "ConfirmedBy",
                table: "Order");

            migrationBuilder.DropColumn(
                name: "ShippingAddress",
                table: "Order");
        }
    }
}
