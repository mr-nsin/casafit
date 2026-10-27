using CasaFit.Application.Entitlements;
using CasaFit.Domain.Entitlements;
using Microsoft.EntityFrameworkCore;

namespace CasaFit.Infrastructure.Persistence;

public sealed class EfEntitlementStore(CasaFitDbContext db, TimeProvider clock) : IEntitlementStore
{
    public Task<EntitlementSnapshot?> GetAsync(Guid accountId, CancellationToken ct) =>
        db.Accounts.AsNoTracking()
            .Where(a => a.Id == accountId)
            .Select(a => new EntitlementSnapshot(a.FreeChecksRemaining, a.ProActive, a.ProExpiresAt, a.ProEventAt))
            .FirstOrDefaultAsync(ct);

    public async Task<T> RunAtomicAsync<T>(Func<CancellationToken, Task<AtomicResult<T>>> work, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var result = await work(ct); // an exception disposes the transaction, which rolls it back
        if (result.Commit) await tx.CommitAsync(ct);
        else await tx.RollbackAsync(ct);
        return result.Value;
    }

    public async Task<bool> TryDecrementAsync(Guid accountId, CancellationToken ct) =>
        await db.Accounts
            .Where(a => a.Id == accountId && a.FreeChecksRemaining > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.FreeChecksRemaining, a => a.FreeChecksRemaining - 1), ct) == 1;

    public async Task<bool> TryIncrementAsync(Guid accountId, int cap, CancellationToken ct) =>
        await db.Accounts
            .Where(a => a.Id == accountId && a.FreeChecksRemaining < cap)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.FreeChecksRemaining, a => a.FreeChecksRemaining + 1), ct) == 1;

    public Task<bool> ConsumeExistsAsync(Guid accountId, string consumeKey, CancellationToken ct) =>
        db.FormCheckEvents.AnyAsync(
            e => e.AccountId == accountId && e.Kind == FormCheckKind.Consume && e.IdempotencyKey == consumeKey, ct);

    public Task<string?> FindRefundKeyAsync(Guid accountId, string consumeKey, CancellationToken ct) =>
        db.FormCheckEvents
            .Where(e => e.AccountId == accountId && e.Kind == FormCheckKind.Refund && e.RelatedKey == consumeKey)
            .Select(e => (string?)e.IdempotencyKey)
            .FirstOrDefaultAsync(ct);

    public async Task<bool> TryRegisterWebhookEventAsync(string eventId, CancellationToken ct)
    {
        // ON CONFLICT DO NOTHING keeps the surrounding transaction usable on a redelivery.
        var now = clock.GetUtcNow();
        var rows = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO processed_webhook_event ("EventId", "ReceivedAt") VALUES ({eventId}, {now}) ON CONFLICT DO NOTHING""", ct);
        return rows == 1;
    }

    public async Task SetProAsync(Guid accountId, bool active, DateTimeOffset? expiresAt, DateTimeOffset eventAt, CancellationToken ct) =>
        await db.Accounts.Where(a => a.Id == accountId).ExecuteUpdateAsync(s => s
            .SetProperty(a => a.ProActive, active)
            .SetProperty(a => a.ProExpiresAt, expiresAt)
            .SetProperty(a => a.ProEventAt, eventAt), ct);
}
