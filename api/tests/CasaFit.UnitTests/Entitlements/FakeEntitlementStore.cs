using CasaFit.Application.Common.Idempotency;
using CasaFit.Application.Entitlements;
using CasaFit.Domain.Entitlements;

namespace CasaFit.UnitTests.Entitlements;

/// <summary>In-memory store and ledger with the same guarded updates and rollback behaviour as the EF versions.</summary>
public sealed class FakeEntitlementStore : IEntitlementStore, IFormCheckLedger
{
    public int Balance { get; set; } = 2;
    public bool ProActive { get; set; }
    public DateTimeOffset? ProExpiresAt { get; set; }
    public DateTimeOffset? ProEventAt { get; set; }
    public bool AccountExists { get; set; } = true;

    public HashSet<(FormCheckKind, string)> Events { get; private set; } = [];
    public Dictionary<string, string> RefundByConsume { get; private set; } = [];
    public HashSet<string> WebhookEvents { get; private set; } = [];

    public Task<EntitlementSnapshot?> GetAsync(Guid accountId, CancellationToken ct) =>
        Task.FromResult(AccountExists ? new EntitlementSnapshot(Balance, ProActive, ProExpiresAt, ProEventAt) : null);

    public async Task<T> RunAtomicAsync<T>(Func<CancellationToken, Task<AtomicResult<T>>> work, CancellationToken ct)
    {
        var (b, e, r, w) = (Balance, Events.ToHashSet(), new Dictionary<string, string>(RefundByConsume), WebhookEvents.ToHashSet());
        var (p, x, pe) = (ProActive, ProExpiresAt, ProEventAt);
        void Restore() { Balance = b; Events = e; RefundByConsume = r; WebhookEvents = w; ProActive = p; ProExpiresAt = x; ProEventAt = pe; }
        try
        {
            var result = await work(ct);
            if (!result.Commit) Restore();
            return result.Value;
        }
        catch
        {
            Restore();
            throw;
        }
    }

    public Task<bool> TryDecrementAsync(Guid accountId, CancellationToken ct)
    {
        if (Balance <= 0) return Task.FromResult(false);
        Balance--;
        return Task.FromResult(true);
    }

    public Task<bool> TryIncrementAsync(Guid accountId, int cap, CancellationToken ct)
    {
        if (Balance >= cap) return Task.FromResult(false);
        Balance++;
        return Task.FromResult(true);
    }

    public Task<bool> ConsumeExistsAsync(Guid accountId, string consumeKey, CancellationToken ct) =>
        Task.FromResult(Events.Contains((FormCheckKind.Consume, consumeKey)));

    public Task<string?> FindRefundKeyAsync(Guid accountId, string consumeKey, CancellationToken ct) =>
        Task.FromResult(RefundByConsume.GetValueOrDefault(consumeKey));

    public Task<bool> TryRegisterWebhookEventAsync(string eventId, CancellationToken ct) =>
        Task.FromResult(WebhookEvents.Add(eventId));

    public Task SetProAsync(Guid accountId, bool active, DateTimeOffset? expiresAt, DateTimeOffset eventAt, CancellationToken ct)
    {
        ProActive = active;
        ProExpiresAt = expiresAt;
        ProEventAt = eventAt;
        return Task.CompletedTask;
    }

    public Task<IdempotencyResult> RecordAsync(
        Guid accountId, FormCheckKind kind, string idempotencyKey, CancellationToken ct, string? relatedKey = null)
    {
        if (!Events.Add((kind, idempotencyKey))) return Task.FromResult(IdempotencyResult.Duplicate);
        if (kind == FormCheckKind.Refund && relatedKey is not null) RefundByConsume[relatedKey] = idempotencyKey;
        return Task.FromResult(IdempotencyResult.Recorded);
    }
}
