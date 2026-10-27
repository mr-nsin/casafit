using CasaFit.Domain.Entitlements;

namespace CasaFit.Application.Common.Idempotency;

public enum IdempotencyResult
{
    /// <summary>First time this key was seen. The caller should apply the change.</summary>
    Recorded,

    /// <summary>The key was already used. The caller must treat the request as a replay and change nothing.</summary>
    Duplicate,
}

/// <summary>
/// The idempotency pattern for billable state (docs/data-model.md section 3, architecture.md 3.3).
/// A client key plus a unique index on (account, kind, key): the database, not the application, decides who wins.
/// Used by entitlements consume and refund.
/// </summary>
public interface IFormCheckLedger
{
    Task<IdempotencyResult> RecordAsync(
        Guid accountId, FormCheckKind kind, string idempotencyKey, CancellationToken ct, string? relatedKey = null);
}
