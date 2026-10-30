using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CasaFit.IntegrationTests;

/// <summary>Mints Supabase-shaped access tokens signed with the test secret.</summary>
public static class TestTokens
{
    public const string Url = "https://test-project.supabase.co";
    public const string Secret = "integration-test-supabase-secret-0123456789abcdef";

    public static string Create(
        string? sub = null,
        string? email = null,
        string provider = "email",
        string? issuer = null,
        string audience = "authenticated",
        string? secret = null,
        DateTime? expires = null,
        string algorithm = SecurityAlgorithms.HmacSha256)
    {
        var claims = new Dictionary<string, object>
        {
            ["sub"] = sub ?? Guid.NewGuid().ToString(),
            ["role"] = "authenticated",
            ["app_metadata"] = new Dictionary<string, object> { ["provider"] = provider, ["providers"] = new[] { provider } },
        };
        if (email is not null) claims["email"] = email;

        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer ?? Url + "/auth/v1",
            Audience = audience,
            IssuedAt = DateTime.UtcNow.AddMinutes(-5),
            NotBefore = DateTime.UtcNow.AddMinutes(-5),
            Expires = expires ?? DateTime.UtcNow.AddHours(1),
            Claims = claims,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret ?? Secret)), algorithm),
        });
    }
}
