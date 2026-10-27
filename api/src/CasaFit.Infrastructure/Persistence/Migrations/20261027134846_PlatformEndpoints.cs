using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CasaFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlatformEndpoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RelatedKey",
                table: "form_check_event",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ProEventAt",
                table: "account",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "consent_record",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Granted = table.Column<bool>(type: "boolean", nullable: false),
                    PolicyVersion = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_record", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_record_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "food_entry",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LoggedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Meal = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    FoodId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Portions = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_food_entry", x => new { x.AccountId, x.Id });
                    table.ForeignKey(
                        name: "FK_food_entry_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "plan",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Goal = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Styles = table.Column<int>(type: "integer", nullable: false),
                    DaysPerWeek = table.Column<int>(type: "integer", nullable: false),
                    Experience = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Variant = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    WeekNumber = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plan", x => x.AccountId);
                    table.ForeignKey(
                        name: "FK_plan_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "processed_webhook_event",
                columns: table => new
                {
                    EventId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_processed_webhook_event", x => x.EventId);
                });

            migrationBuilder.CreateTable(
                name: "session_log",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanWeek = table.Column<int>(type: "integer", nullable: false),
                    PlanDay = table.Column<int>(type: "integer", nullable: false),
                    Style = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DurationS = table.Column<int>(type: "integer", nullable: false),
                    Felt = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_session_log", x => new { x.AccountId, x.Id });
                    table.ForeignKey(
                        name: "FK_session_log_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "step_summary",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    OnDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Steps = table.Column<int>(type: "integer", nullable: false),
                    BriskMinutes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_step_summary", x => new { x.AccountId, x.OnDate });
                    table.ForeignKey(
                        name: "FK_step_summary_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_form_check_event_AccountId_RelatedKey",
                table: "form_check_event",
                columns: new[] { "AccountId", "RelatedKey" },
                unique: true,
                filter: "\"RelatedKey\" IS NOT NULL AND \"Kind\" = 'Refund'");

            migrationBuilder.CreateIndex(
                name: "IX_consent_record_AccountId_RecordedAt",
                table: "consent_record",
                columns: new[] { "AccountId", "RecordedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "consent_record");

            migrationBuilder.DropTable(
                name: "food_entry");

            migrationBuilder.DropTable(
                name: "plan");

            migrationBuilder.DropTable(
                name: "processed_webhook_event");

            migrationBuilder.DropTable(
                name: "session_log");

            migrationBuilder.DropTable(
                name: "step_summary");

            migrationBuilder.DropIndex(
                name: "IX_form_check_event_AccountId_RelatedKey",
                table: "form_check_event");

            migrationBuilder.DropColumn(
                name: "RelatedKey",
                table: "form_check_event");

            migrationBuilder.DropColumn(
                name: "ProEventAt",
                table: "account");
        }
    }
}
