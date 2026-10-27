using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CasaFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PhoneE164 = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    EmailNorm = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Locale = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Onboarded = table.Column<bool>(type: "boolean", nullable: false),
                    FreeChecksRemaining = table.Column<int>(type: "integer", nullable: false),
                    ProActive = table.Column<bool>(type: "boolean", nullable: false),
                    ProExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "account_identifier_hash",
                columns: table => new
                {
                    Hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_account_identifier_hash", x => x.Hash);
                });

            migrationBuilder.CreateTable(
                name: "form_check_event",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_form_check_event", x => x.Id);
                    table.ForeignKey(
                        name: "FK_form_check_event_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "otp_attempt",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    IdentifierHash = table.Column<byte[]>(type: "bytea", nullable: false),
                    Channel = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Success = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_otp_attempt", x => x.Id);
                    table.ForeignKey(
                        name: "FK_otp_attempt_account_AccountId",
                        column: x => x.AccountId,
                        principalTable: "account",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_account_EmailNorm",
                table: "account",
                column: "EmailNorm",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_PhoneE164",
                table: "account",
                column: "PhoneE164",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_identifier_hash_ExpiresAt",
                table: "account_identifier_hash",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_form_check_event_AccountId_Kind_IdempotencyKey",
                table: "form_check_event",
                columns: new[] { "AccountId", "Kind", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_otp_attempt_AccountId",
                table: "otp_attempt",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_otp_attempt_IdentifierHash_CreatedAt",
                table: "otp_attempt",
                columns: new[] { "IdentifierHash", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "account_identifier_hash");

            migrationBuilder.DropTable(
                name: "form_check_event");

            migrationBuilder.DropTable(
                name: "otp_attempt");

            migrationBuilder.DropTable(
                name: "account");
        }
    }
}
