using System.Text;
using CasaFit.Application.Auth;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CasaFit.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string Section = "Jwt";

    public string Secret { get; set; } = "";
    public string Issuer { get; set; } = "casafit-api";
    public string Audience { get; set; } = "casafit-app";
    public int AccessTtlSeconds { get; set; } = 900;
    public int RefreshTtlSeconds { get; set; } = 2_592_000;

    public string RefreshAudience => Audience + ":refresh";

    public SymmetricSecurityKey SigningKey => new(Encoding.UTF8.GetBytes(Secret));
}

public sealed class JwtTokenService(IOptions<JwtOptions> options, TimeProvider clock) : ITokenService
{
    private readonly JsonWebTokenHandler _handler = new();

    public TokenPair Issue(Guid accountId)
    {
        var o = options.Value;
        return new TokenPair(
            Create(accountId, o.Audience, TimeSpan.FromSeconds(o.AccessTtlSeconds)),
            Create(accountId, o.RefreshAudience, TimeSpan.FromSeconds(o.RefreshTtlSeconds)));
    }

    private string Create(Guid accountId, string audience, TimeSpan lifetime)
    {
        var o = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        return _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = o.Issuer,
            Audience = audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now + lifetime,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = accountId.ToString(),
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N"),
            },
            SigningCredentials = new SigningCredentials(o.SigningKey, SecurityAlgorithms.HmacSha256),
        });
    }
}
