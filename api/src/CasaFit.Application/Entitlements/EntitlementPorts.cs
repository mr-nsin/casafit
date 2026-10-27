namespace CasaFit.Application.Entitlements;

public sealed record EntitlementSnapshot(
    int FreeChecksRemaining, bool ProActive, DateTimeOffset? ProExpiresAt, DateTimeOffset? ProEventAt);

/// <summary>What a unit of atomic work returns: the value, and whether to commit or roll back.</summary>
public readonly record struct AtomicResult<T>(T Value, bool Commit);

/// <summary>
/// Database operations for the free-check balance and Pro state. The balance changes only through the two
/// guarded updates below, so it can never drop under zero or rise over the lifetime allowance, and there is no reset.
/// </summary>
public interface IEntitlementStore
{
    Task<EntitlementSnapshot?> GetAsync(Guid accountId, CancellationToken ct);

    /// <summary>Runs the work in one transaction. Rolls back when Commit is false or the work throws.</summary>
    Task<T> RunAtomicAsync<T>(Func<CancellationToken, Task<AtomicResult<T>>> work, CancellationToken ct);

    /// <summary>Subtracts one when the balance is above zero. False when it was already zero.</summary>
    Task<bool> TryDecrementAsync(Guid accountId, CancellationToken ct);

    /// <summary>Adds one when the balance is under the cap. False when it was already at the cap.</summary>
    Task<bool> TryIncrementAsync(Guid accountId, int cap, CancellationToken ct);

    Task<bool> ConsumeExistsAsync(Guid accountId, string consumeKey, CancellationToken ct);

    /// <summary>The idempotency key of the refund already recorded for this consume, or null.</summary>
    Task<string?> FindRefundKeyAsync(Guid accountId, string consumeKey, CancellationToken ct);

    /// <summary>False when the webhook event id was seen before.</summary>
    Task<bool> TryRegisterWebhookEventAsync(string eventId, CancellationToken ct);

    Task SetProAsync(Guid accountId, bool active, DateTimeOffset? expiresAt, DateTimeOffset eventAt, CancellationToken ct);
}
