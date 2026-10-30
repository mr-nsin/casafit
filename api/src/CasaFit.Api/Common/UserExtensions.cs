using System.Security.Claims;
using CasaFit.Application.Common;

namespace CasaFit.Api.Common;

public static class UserExtensions
{
    /// <summary>The local account id, set when the Supabase token was validated and the account provisioned.</summary>
    public static Guid AccountId(this ClaimsPrincipal user)
    {
        if (Guid.TryParse(user.FindFirstValue(SupabaseClaims.AccountIdClaim), out var id)) return id;
        if (user.HasClaim(SupabaseClaims.DeletedClaim, "true"))
            throw new DomainException(401, "account_deleted", "This account was deleted. Sign in with a new account.");
        throw new DomainException(401, "invalid_token", "The session is not valid. Sign in again.");
    }

    /// <summary>The Supabase user id (sub claim).</summary>
    public static string ExternalId(this ClaimsPrincipal user) =>
        user.FindFirstValue("sub")
        ?? throw new DomainException(401, "invalid_token", "The session is not valid. Sign in again.");
}
