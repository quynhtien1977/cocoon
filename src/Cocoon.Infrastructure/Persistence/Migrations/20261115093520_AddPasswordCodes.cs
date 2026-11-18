using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PasswordResetToken_AccountId",
                table: "PasswordResetToken");

            migrationBuilder.AddColumn<int>(
                name: "Attempts",
                table: "PasswordResetToken",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "PasswordResetToken",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                table: "PasswordResetToken",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetToken_AccountId_CreatedAt",
                table: "PasswordResetToken",
                columns: new[] { "AccountId", "CreatedAt" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_PasswordResetToken_Attempts",
                table: "PasswordResetToken",
                sql: "\"Attempts\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PasswordResetToken_AccountId_CreatedAt",
                table: "PasswordResetToken");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PasswordResetToken_Attempts",
                table: "PasswordResetToken");

            migrationBuilder.DropColumn(
                name: "Attempts",
                table: "PasswordResetToken");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "PasswordResetToken");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "PasswordResetToken");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetToken_AccountId",
                table: "PasswordResetToken",
                column: "AccountId");
        }
    }
}
