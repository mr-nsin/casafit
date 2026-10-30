using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using CasaFit.Domain.Entitlements;
using CasaFit.Domain.Tracking;
using Microsoft.EntityFrameworkCore;

namespace CasaFit.Infrastructure.Persistence;

public sealed class CasaFitDbContext(DbContextOptions<CasaFitDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<FormCheckEvent> FormCheckEvents => Set<FormCheckEvent>();
    public DbSet<DeletedIdentifierHash> DeletedIdentifierHashes => Set<DeletedIdentifierHash>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<ConsentRecord> ConsentRecords => Set<ConsentRecord>();
    public DbSet<SessionLog> SessionLogs => Set<SessionLog>();
    public DbSet<FoodEntry> FoodEntries => Set<FoodEntry>();
    public DbSet<StepSummary> StepSummaries => Set<StepSummary>();
    public DbSet<ProcessedWebhookEvent> ProcessedWebhookEvents => Set<ProcessedWebhookEvent>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Account>(e =>
        {
            e.ToTable("account");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.ExternalId).HasMaxLength(128).IsRequired();
            e.Property(x => x.Email).HasMaxLength(320);
            e.Property(x => x.Provider).HasMaxLength(16).IsRequired();
            e.Property(x => x.Locale).HasMaxLength(16);
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.Email).IsUnique();
        });

        b.Entity<FormCheckEvent>(e =>
        {
            e.ToTable("form_check_event");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.IdempotencyKey).HasMaxLength(128);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.RelatedKey).HasMaxLength(128);
            e.HasIndex(x => new { x.AccountId, x.Kind, x.IdempotencyKey }).IsUnique();
            // One refund per consume.
            e.HasIndex(x => new { x.AccountId, x.RelatedKey }).IsUnique()
                .HasFilter("\"RelatedKey\" IS NOT NULL AND \"Kind\" = 'Refund'");
        });

        b.Entity<DeletedIdentifierHash>(e =>
        {
            e.ToTable("account_identifier_hash");
            e.HasKey(x => x.Hash);
            e.HasIndex(x => x.ExpiresAt);
        });

        b.Entity<Plan>(e =>
        {
            e.ToTable("plan");
            e.HasKey(x => x.AccountId);
            e.Property(x => x.AccountId).ValueGeneratedNever();
            e.Property(x => x.Goal).HasMaxLength(16);
            e.Property(x => x.Experience).HasMaxLength(16);
            e.Property(x => x.Variant).HasMaxLength(32);
            e.HasOne<Account>().WithOne().HasForeignKey<Plan>(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ConsentRecord>(e =>
        {
            e.ToTable("consent_record");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Type).HasMaxLength(32);
            e.Property(x => x.PolicyVersion).HasMaxLength(32);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.AccountId, x.RecordedAt });
        });

        b.Entity<SessionLog>(e =>
        {
            e.ToTable("session_log");
            e.HasKey(x => new { x.AccountId, x.Id });
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Style).HasMaxLength(16);
            e.Property(x => x.Felt).HasMaxLength(16);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<FoodEntry>(e =>
        {
            e.ToTable("food_entry");
            e.HasKey(x => new { x.AccountId, x.Id });
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Meal).HasMaxLength(16);
            e.Property(x => x.FoodId).HasMaxLength(64);
            e.Property(x => x.Portions).HasPrecision(5, 2);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<StepSummary>(e =>
        {
            e.ToTable("step_summary");
            e.HasKey(x => new { x.AccountId, x.OnDate });
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProcessedWebhookEvent>(e =>
        {
            e.ToTable("processed_webhook_event");
            e.HasKey(x => x.EventId);
            e.Property(x => x.EventId).HasMaxLength(128);
        });
    }
}
