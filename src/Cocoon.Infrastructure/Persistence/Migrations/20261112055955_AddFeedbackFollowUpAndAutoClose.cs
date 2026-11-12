using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackFollowUpAndAutoClose : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FeedbackReply_FeedbackId",
                table: "FeedbackReply");

            migrationBuilder.AddColumn<int>(
                name: "Round",
                table: "FeedbackReply",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "AutoCloseAt",
                table: "Feedback",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FollowUpAt",
                table: "Feedback",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FollowUpContent",
                table: "Feedback",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackReply_FeedbackId_Round",
                table: "FeedbackReply",
                columns: new[] { "FeedbackId", "Round" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_FeedbackReply_Round",
                table: "FeedbackReply",
                sql: "\"Round\" IN (1, 2)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Feedback_FollowUp",
                table: "Feedback",
                sql: "(\"FollowUpContent\" IS NULL) = (\"FollowUpAt\" IS NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FeedbackReply_FeedbackId_Round",
                table: "FeedbackReply");

            migrationBuilder.DropCheckConstraint(
                name: "CK_FeedbackReply_Round",
                table: "FeedbackReply");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Feedback_FollowUp",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "Round",
                table: "FeedbackReply");

            migrationBuilder.DropColumn(
                name: "AutoCloseAt",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "FollowUpAt",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "FollowUpContent",
                table: "Feedback");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackReply_FeedbackId",
                table: "FeedbackReply",
                column: "FeedbackId",
                unique: true);
        }
    }
}
