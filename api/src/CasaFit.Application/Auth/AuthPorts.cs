using CasaFit.Domain.Accounts;

namespace CasaFit.Application.Auth;

/// <summary>What we read from a verified Supabase access token.</summary>
public sealed record ExternalIdentity(string ExternalId, string? Email, string Provider)
{
    public static readonly string[] Providers = ["email", "google", "apple", "facebook"];

    /// <summary>Unknown or missing providers (phone, github and so on) are stored as email.</summary>
    public static string NormaliseProvider(string? provider)
    {
        var p = provider?.Trim().ToLowerInvariant();
        return p is not null && Providers.Contains(p) ? p : "email";
    }
}

/// <summary>Outcome of provisioning: the account id, or a tombstone when the user deleted the account.</summary>
public sealed record ProvisionResult(Guid? AccountId, bool Deleted);

public interface IAuthStore
{
    /// <summary>
    /// Finds the account by Supabase id, or creates it. Safe under concurrent first requests: the loser of the
    /// unique-index race reads the winner's row. Refreshes email and provider when the token carries new values.
    /// </summary>
    Task<Account> GetOrCreateByExternalIdAsync(ExternalIdentity identity, int freeChecks, CancellationToken ct);

    Task<Account?> FindByExternalIdAsync(string externalId, CancellationToken ct);
    Task<bool> IsDeletedIdentifierAsync(byte[] hash, CancellationToken ct);
}

/// <summary>Supabase admin API. Real client in Infrastructure; a fake in tests.</summary>
public interface IIdentityAdmin
{
    /// <summary>Deletes the Supabase user. A user that no longer exists counts as deleted. Throws <see cref="IdentityAdminException"/> on failure.</summary>
    Task DeleteUserAsync(string externalId, CancellationToken ct);
}

public sealed class IdentityAdminException(string message, Exception? inner = null) : Exception(message, inner);
