using System.Net;
using CasaFit.Application.Auth;
using Microsoft.Extensions.Options;

namespace CasaFit.Infrastructure.Auth;

/// <summary>Supabase Auth admin API: DELETE /auth/v1/admin/users/{id} with the service role key.</summary>
public sealed class SupabaseIdentityAdmin(IOptions<SupabaseOptions> options) : IIdentityAdmin
{
    private readonly HttpClient _http = new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5) })
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

    public async Task DeleteUserAsync(string externalId, CancellationToken ct)
    {
        var o = options.Value;
        if (string.IsNullOrEmpty(o.Url) || string.IsNullOrEmpty(o.ServiceRoleKey))
            throw new IdentityAdminException("Supabase__Url and Supabase__ServiceRoleKey are not set.");
        if (!Guid.TryParse(externalId, out var id))
            throw new IdentityAdminException("The Supabase user id is not a GUID.");

        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{o.Issuer}/admin/users/{id}");
        request.Headers.TryAddWithoutValidation("apikey", o.ServiceRoleKey);
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer " + o.ServiceRoleKey);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            // Already gone is success: this makes the retry after a partial failure safe.
            if (response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.NotFound) return;
            throw new IdentityAdminException($"Supabase admin delete returned {(int)response.StatusCode}.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new IdentityAdminException("Supabase admin delete could not be reached.", ex);
        }
    }
}
