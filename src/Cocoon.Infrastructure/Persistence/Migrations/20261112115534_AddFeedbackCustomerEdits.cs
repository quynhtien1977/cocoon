using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackCustomerEdits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClosedBy",
                table: "Feedback",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ContentEditedAt",
                table: "Feedback",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalRating",
                table: "Feedback",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RatingEditedAt",
                table: "Feedback",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Feedback_ClosedBy",
                table: "Feedback",
                sql: "\"ClosedBy\" IS NULL OR \"Status\" = 'Closed'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Feedback_RatingEdit",
                table: "Feedback",
                sql: "(\"OriginalRating\" IS NULL) = (\"RatingEditedAt\" IS NULL) AND (\"OriginalRating\" IS NULL OR \"OriginalRating\" BETWEEN 1 AND 5)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Feedback_ClosedBy",
                table: "Feedback");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Feedback_RatingEdit",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "ClosedBy",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "ContentEditedAt",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "OriginalRating",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "RatingEditedAt",
                table: "Feedback");
        }
    }
}
