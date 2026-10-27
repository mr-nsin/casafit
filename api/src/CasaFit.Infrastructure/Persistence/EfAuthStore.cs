using CasaFit.Application.Auth;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CasaFit.Infrastructure.Persistence;

public sealed class EfAuthStore(CasaFitDbContext db, TimeProvider clock) : IAuthStore
{
    public Task<Account?> FindAccountAsync(IdentifierKind kind, string normalised, CancellationToken ct) =>
        kind == IdentifierKind.Phone
            ? db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.PhoneE164 == normalised, ct)
            : db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.EmailNorm == normalised, ct);

    public async Task<(Account Account, bool Created)> GetOrCreateAccountAsync(
        IdentifierKind kind, string normalised, int freeChecks, CancellationToken ct)
    {
        var account = new Account
        {
            Id = Guid.NewGuid(),
            CreatedAt = clock.GetUtcNow(),
            FreeChecksRemaining = freeChecks,
            PhoneE164 = kind == IdentifierKind.Phone ? normalised : null,
            EmailNorm = kind == IdentifierKind.Email ? normalised : null,
        };

        db.Accounts.Add(account);
        try
        {
            await db.SaveChangesAsync(ct);
            return (account, true);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // A concurrent verify created the same account first. Use theirs.
            db.Entry(account).State = EntityState.Detached;
            var existing = await FindAccountAsync(kind, normalised, ct)
                           ?? throw new InvalidOperationException("Account vanished after unique violation.");
            return (existing, false);
        }
    }

    public Task<bool> IsDeletedIdentifierAsync(byte[] hash, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return db.DeletedIdentifierHashes.AnyAsync(d => d.Hash == hash && d.ExpiresAt > now, ct);
    }

    public async Task RecordOtpAttemptAsync(OtpAttempt attempt, CancellationToken ct)
    {
        db.OtpAttempts.Add(attempt);
        await db.SaveChangesAsync(ct);
    }
}
