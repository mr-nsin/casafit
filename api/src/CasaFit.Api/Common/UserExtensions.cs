using System.Security.Claims;
using CasaFit.Application.Common;

namespace CasaFit.Api.Common;

public static class UserExtensions
{
    /// <summary>The account id in the token's sub claim.</summary>
    public static Guid AccountId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("sub"), out var id)
            ? id
            : throw new DomainException(401, "invalid_token", "The session is not valid. Sign in again.");
}
