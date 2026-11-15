using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cocoon.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MoveSurveyMediaToQuestions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

            migrationBuilder.CreateTable(
                name: "SurveyImage",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SurveyId = table.Column<int>(type: "integer", nullable: false),
                    ObjectKey = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyImage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyImage_Survey_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Survey",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuestionMedia",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    QuestionId = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ImageId = table.Column<int>(type: "integer", nullable: true),
                    YoutubeVideoId = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestionMedia", x => x.Id);
                    table.CheckConstraint("CK_SurveyQuestionMedia_Kind", "(\"Kind\" = 'Image' AND \"ImageId\" IS NOT NULL AND \"YoutubeVideoId\" IS NULL) OR (\"Kind\" = 'Video' AND \"YoutubeVideoId\" IS NOT NULL AND \"ImageId\" IS NULL)");
                    table.ForeignKey(
                        name: "FK_SurveyQuestionMedia_SurveyImage_ImageId",
                        column: x => x.ImageId,
                        principalTable: "SurveyImage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyQuestionMedia_SurveyQuestion_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "SurveyQuestion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyImage_ObjectKey",
                table: "SurveyImage",
                column: "ObjectKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyImage_SurveyId",
                table: "SurveyImage",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestionMedia_ImageId",
                table: "SurveyQuestionMedia",
                column: "ImageId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestionMedia_QuestionId_SortOrder",
                table: "SurveyQuestionMedia",
                columns: new[] { "QuestionId", "SortOrder" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyQuestionMedia");

            migrationBuilder.DropTable(
                name: "SurveyImage");

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
    }
}
