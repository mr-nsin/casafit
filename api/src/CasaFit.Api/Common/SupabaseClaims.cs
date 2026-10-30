using System.Security.Claims;
using System.Text.Json;
using CasaFit.Application.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace CasaFit.Api.Common;

/// <summary>Reads the Supabase token claims and turns them into a local account on the first request.</summary>
public static class SupabaseClaims
{
    public const string AccountIdClaim = "casafit_account_id";
    public const string DeletedClaim = "casafit_account_deleted";

    public static async Task ProvisionAsync(TokenValidatedContext ctx)
    {
        var principal = ctx.Principal;
        var sub = principal?.FindFirstValue("sub");
        if (principal?.Identity is not ClaimsIdentity identity || string.IsNullOrWhiteSpace(sub) || sub.Length > 128)
        {
            ctx.Fail("The token has no subject.");
            return;
        }

        var identityInfo = new ExternalIdentity(
            sub,
            NormaliseEmail(principal.FindFirstValue("email")),
            ExternalIdentity.NormaliseProvider(ProviderOf(principal.FindFirstValue("app_metadata"))));

        var provisioner = ctx.HttpContext.RequestServices.GetRequiredService<AccountProvisioner>();
        var result = await provisioner.EnsureAsync(identityInfo, ctx.HttpContext.RequestAborted);
        if (result.AccountId is { } id) identity.AddClaim(new Claim(AccountIdClaim, id.ToString()));
        if (result.Deleted) identity.AddClaim(new Claim(DeletedClaim, "true"));
    }

    private static string? NormaliseEmail(string? email) =>
        string.IsNullOrWhiteSpace(email) || email.Length > 320 ? null : EmailIdentity.Lower(email);

    private static string? ProviderOf(string? appMetadataJson)
    {
        if (string.IsNullOrEmpty(appMetadataJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(appMetadataJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object &&
                   doc.RootElement.TryGetProperty("provider", out var p) && p.ValueKind == JsonValueKind.String
                ? p.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
