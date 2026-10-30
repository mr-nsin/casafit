using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace CasaFit.Infrastructure.Auth;

/// <summary>Supabase Auth settings. Environment variables: Supabase__Url, Supabase__JwtSecret, Supabase__ServiceRoleKey.</summary>
public sealed class SupabaseOptions
{
    public const string Section = "Supabase";
    public const string Audience = "authenticated";

    /// <summary>Project URL, for example https://abcd.supabase.co. Gives the issuer, the JWKS and the admin API.</summary>
    public string Url { get; set; } = "";

    /// <summary>Legacy HS256 JWT secret. Optional: tokens signed with asymmetric keys are checked against the JWKS.</summary>
    public string JwtSecret { get; set; } = "";

    /// <summary>Server-only key for the admin API (delete user). Never sent to the app.</summary>
    public string ServiceRoleKey { get; set; } = "";

    public string BaseUrl => Url.TrimEnd('/');
    public string Issuer => BaseUrl + "/auth/v1";
    public string JwksUrl => Issuer + "/.well-known/jwks.json";

    public SymmetricSecurityKey? SymmetricKey =>
        string.IsNullOrEmpty(JwtSecret) ? null : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
}
