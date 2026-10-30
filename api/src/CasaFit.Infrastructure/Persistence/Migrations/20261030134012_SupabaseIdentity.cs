using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CasaFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SupabaseIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Dev databases only: accounts created with phone or email login have no Supabase id and cannot be mapped.
            // Cascades remove plans, consents, sessions, food, steps and form-check events.
            migrationBuilder.Sql("DELETE FROM account;");
            migrationBuilder.Sql("DELETE FROM account_identifier_hash;");

            migrationBuilder.DropTable(
                name: "otp_attempt");

            migrationBuilder.DropIndex(
                name: "IX_account_PhoneE164",
                table: "account");

            migrationBuilder.DropColumn(
                name: "PhoneE164",
                table: "account");

            migrationBuilder.RenameColumn(
                name: "EmailNorm",
                table: "account",
                newName: "Email");

            migrationBuilder.RenameIndex(
                name: "IX_account_EmailNorm",
                table: "account",
                newName: "IX_account_Email");

            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "account",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "account",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_account_ExternalId",
                table: "account",
                column: "ExternalId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_account_ExternalId",
                table: "account");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "account");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "account");

            migrationBuilder.RenameColumn(
                name: "Email",
                table: "account",
                newName: "EmailNorm");

            migrationBuilder.RenameIndex(
                name: "IX_account_Email",
                table: "account",
                newName: "IX_account_EmailNorm");

            migrationBuilder.AddColumn<string>(
                name: "PhoneE164",
                table: "account",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "otp_attempt",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Channel = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IdentifierHash = table.Column<byte[]>(type: "bytea", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Success = table.Column<bool>(type: "boolean", nullable: false)
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
                name: "IX_account_PhoneE164",
                table: "account",
                column: "PhoneE164",
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
    }
}
