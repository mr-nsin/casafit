using CasaFit.Application.Auth;
using CasaFit.Domain.Accounts;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CasaFit.Infrastructure.Persistence;

public sealed class EfAuthStore(CasaFitDbContext db, TimeProvider clock) : IAuthStore
{
    public Task<Account?> FindByExternalIdAsync(string externalId, CancellationToken ct) =>
        db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.ExternalId == externalId, ct);

    public async Task<Account> GetOrCreateByExternalIdAsync(ExternalIdentity identity, int freeChecks, CancellationToken ct)
    {
        var email = identity.Email is null ? null : EmailIdentity.Lower(identity.Email);

        var existing = await db.Accounts.FirstOrDefaultAsync(a => a.ExternalId == identity.ExternalId, ct);
        if (existing is not null)
        {
            await RefreshAsync(existing, email, identity.Provider, ct);
            return existing;
        }

        var account = Build(identity, email, freeChecks);
        db.Accounts.Add(account);
        try
        {
            await db.SaveChangesAsync(ct);
            return account;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            db.Entry(account).State = EntityState.Detached;
        }

        // A concurrent first request created the same user: use theirs.
        var winner = await db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.ExternalId == identity.ExternalId, ct);
        if (winner is not null) return winner;

        // The email already belongs to another account (two Supabase users, one address). Keep the account, drop the email.
        var withoutEmail = Build(identity, null, freeChecks);
        db.Accounts.Add(withoutEmail);
        try
        {
            await db.SaveChangesAsync(ct);
            return withoutEmail;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            db.Entry(withoutEmail).State = EntityState.Detached;
            return await db.Accounts.AsNoTracking().FirstAsync(a => a.ExternalId == identity.ExternalId, ct);
        }
    }

    public Task<bool> IsDeletedIdentifierAsync(byte[] hash, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return db.DeletedIdentifierHashes.AnyAsync(d => d.Hash == hash && d.ExpiresAt > now, ct);
    }

    private Account Build(ExternalIdentity identity, string? email, int freeChecks) => new()
    {
        Id = Guid.NewGuid(),
        ExternalId = identity.ExternalId,
        Email = email,
        Provider = identity.Provider,
        CreatedAt = clock.GetUtcNow(),
        FreeChecksRemaining = freeChecks,
    };

    private async Task RefreshAsync(Account account, string? email, string provider, CancellationToken ct)
    {
        var changed = false;
        if (account.Provider != provider) { account.Provider = provider; changed = true; }
        if (email is not null && account.Email != email) { account.Email = email; changed = true; }
        if (!changed) return;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // New email already used by another account: leave this one as it was.
            await db.Entry(account).ReloadAsync(ct);
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
