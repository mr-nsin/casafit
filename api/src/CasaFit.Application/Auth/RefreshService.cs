using CasaFit.Application.Accounts;
using CasaFit.Application.Common;

namespace CasaFit.Application.Auth;

/// <summary>
/// Trades a refresh token for a new pair. Stateless rotation: the old refresh token stays valid until it expires.
/// A deleted account cannot refresh.
/// </summary>
public sealed class RefreshService(ITokenService tokens, IAccountStore accounts)
{
    public async Task<TokenPair> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        var accountId = await tokens.ValidateRefreshAsync(request.RefreshToken);
        if (accountId is null || await accounts.GetAsync(accountId.Value, ct) is null)
            throw new DomainException(AuthStatus.Unauthorized, "invalid_refresh", "The session has expired. Sign in again.");
        return tokens.Issue(accountId.Value);
    }
}
