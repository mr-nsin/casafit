using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CasaFit.Infrastructure.Auth;

/// <summary>
/// Picks the keys a Supabase access token may be verified with. HS256 tokens only ever see the shared secret and
/// asymmetric tokens only ever see keys from the project JWKS, so a token cannot choose a weaker algorithm.
/// The JWKS is cached for 10 minutes and re-read at most once a minute when a token names an unknown kid.
/// </summary>
public sealed class SupabaseSigningKeys(IOptions<SupabaseOptions> options, TimeProvider clock, ILogger<SupabaseSigningKeys> log)
{
    public static readonly string[] AllowedAlgorithms =
        [SecurityAlgorithms.HmacSha256, SecurityAlgorithms.EcdsaSha256, SecurityAlgorithms.RsaSha256];

    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan MinRefresh = TimeSpan.FromMinutes(1);

    private readonly HttpClient _http = new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5) })
    {
        Timeout = TimeSpan.FromSeconds(5),
    };
    private readonly object _gate = new();
    private IReadOnlyList<SecurityKey> _jwks = [];
    private DateTimeOffset _fetchedAt = DateTimeOffset.MinValue;
    private DateTimeOffset _triedAt = DateTimeOffset.MinValue;

    /// <summary>Signature of <see cref="TokenValidationParameters.IssuerSigningKeyResolver"/>.</summary>
    public IEnumerable<SecurityKey> Resolve(string token, SecurityToken? securityToken, string? kid, TokenValidationParameters parameters)
    {
        var alg = (securityToken as JsonWebToken)?.Alg;
        if (alg == SecurityAlgorithms.HmacSha256)
        {
            var key = options.Value.SymmetricKey;
            return key is null ? [] : [key];
        }
        if (alg is null || !AllowedAlgorithms.Contains(alg)) return [];

        var keys = LoadJwks(kid);
        return kid is null ? keys : keys.Where(k => k.KeyId == kid);
    }

    private IReadOnlyList<SecurityKey> LoadJwks(string? kid)
    {
        var now = clock.GetUtcNow();
        lock (_gate)
        {
            var stale = now - _fetchedAt > Ttl;
            var unknownKid = kid is not null && !_jwks.Any(k => k.KeyId == kid);
            if ((stale || unknownKid) && now - _triedAt > MinRefresh)
            {
                _triedAt = now;
                try
                {
                    var json = _http.GetStringAsync(options.Value.JwksUrl).GetAwaiter().GetResult();
                    _jwks = new JsonWebKeySet(json).GetSigningKeys().ToList();
                    _fetchedAt = now;
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or ArgumentException)
                {
                    log.LogWarning(ex, "Could not read the Supabase JWKS; using the cached keys");
                }
            }
            return _jwks;
        }
    }
}
