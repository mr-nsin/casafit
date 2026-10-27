using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using CasaFit.Domain.Entitlements;
using Microsoft.EntityFrameworkCore;

namespace CasaFit.Infrastructure.Persistence;

public sealed class CasaFitDbContext(DbContextOptions<CasaFitDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<OtpAttempt> OtpAttempts => Set<OtpAttempt>();
    public DbSet<FormCheckEvent> FormCheckEvents => Set<FormCheckEvent>();
    public DbSet<DeletedIdentifierHash> DeletedIdentifierHashes => Set<DeletedIdentifierHash>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Account>(e =>
        {
            e.ToTable("account");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.PhoneE164).HasMaxLength(20);
            e.Property(x => x.EmailNorm).HasMaxLength(320);
            e.Property(x => x.Locale).HasMaxLength(16);
            e.HasIndex(x => x.PhoneE164).IsUnique();
            e.HasIndex(x => x.EmailNorm).IsUnique();
        });

        b.Entity<OtpAttempt>(e =>
        {
            e.ToTable("otp_attempt");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Channel).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(x => new { x.IdentifierHash, x.CreatedAt });
        });

        b.Entity<FormCheckEvent>(e =>
        {
            e.ToTable("form_check_event");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.IdempotencyKey).HasMaxLength(128);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.AccountId, x.Kind, x.IdempotencyKey }).IsUnique();
        });

        b.Entity<DeletedIdentifierHash>(e =>
        {
            e.ToTable("account_identifier_hash");
            e.HasKey(x => x.Hash);
            e.HasIndex(x => x.ExpiresAt);
        });
    }
}
