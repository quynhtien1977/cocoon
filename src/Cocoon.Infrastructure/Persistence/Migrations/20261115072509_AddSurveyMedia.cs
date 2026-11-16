using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageContentType",
                table: "Survey",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageObjectKey",
                table: "Survey",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "YoutubeVideoId",
                table: "Survey",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Survey_Image",
                table: "Survey",
                sql: "(\"ImageObjectKey\" IS NULL AND \"ImageContentType\" IS NULL) OR (\"ImageObjectKey\" IS NOT NULL AND \"ImageContentType\" IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Survey_Image",
                table: "Survey");

            migrationBuilder.DropColumn(
                name: "ImageContentType",
                table: "Survey");

            migrationBuilder.DropColumn(
                name: "ImageObjectKey",
                table: "Survey");

            migrationBuilder.DropColumn(
                name: "YoutubeVideoId",
                table: "Survey");
        }
    }
}
