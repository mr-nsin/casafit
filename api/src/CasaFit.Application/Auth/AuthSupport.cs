using System.Security.Cryptography;
using System.Text;

namespace CasaFit.Application.Auth;

public sealed class AuthOptions
{
    public const string Section = "Auth";

    /// <summary>Server-side secret for hashing identifiers. Set Auth__Pepper in every environment.</summary>
    public string Pepper { get; set; } = "";
}

/// <summary>HTTP status numbers, so the Application layer does not depend on ASP.NET.</summary>
public static class AuthStatus
{
    public const int BadRequest = 400;
    public const int Unauthorized = 401;
    public const int Forbidden = 403;
    public const int BadGateway = 502;
}

/// <summary>The one place identifiers are hashed, so provisioning and account deletion always agree.</summary>
public static class IdentifierHasher
{
    public static byte[] Hash(byte[] pepper, string normalised) =>
        HMACSHA256.HashData(pepper, Encoding.UTF8.GetBytes(normalised));

    public static byte[] ForEmail(byte[] pepper, string email) => Hash(pepper, EmailIdentity.Canonical(email));

    /// <summary>Tombstone for a Supabase user id, so a still-valid token cannot re-create a deleted account.</summary>
    public static byte[] ForExternalId(byte[] pepper, string externalId) => Hash(pepper, "sub:" + externalId);
}
