using CasaFit.Application.Auth;

namespace CasaFit.Application.Entitlements;

public static class EntitlementRules
{
    public const int FreeChecksForLife = Domain.Accounts.Account.FreeChecksForLife;

    /// <summary>Decision D5: the credit is spent at rep 3, so a refund is legal only for fewer than 3 reps.</summary>
    public const int RefundBeforeRep = 3;

    public static ProState ProOf(bool active, DateTimeOffset? expiresAt, DateTimeOffset now) =>
        new(IsProActive(active, expiresAt, now), expiresAt);

    public static bool IsProActive(bool active, DateTimeOffset? expiresAt, DateTimeOffset now) =>
        active && (expiresAt is null || expiresAt > now);
}
