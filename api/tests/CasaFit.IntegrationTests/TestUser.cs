using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CasaFit.IntegrationTests;

/// <summary>A signed-in test user with its own HttpClient carrying the bearer token.</summary>
public sealed class TestUser
{
    public required HttpClient Client { get; init; }
    public required string Phone { get; init; }
    public required string AccessToken { get; init; }
    public required string RefreshToken { get; init; }
    public required Guid Id { get; init; }

    public static string NewPhone() => "9" + Random.Shared.NextInt64(100_000_000, 999_999_999);

    public static async Task<TestUser> SignInAsync(ApiFactory factory, string? phone = null)
    {
        phone ??= NewPhone();
        var anon = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        await anon.PostAsJsonAsync("/v1/auth/code", new { phone });
        var code = factory.Outbox.LastCodeFor("+91" + phone);
        var res = await anon.PostAsJsonAsync("/v1/auth/verify", new { phone, code });
        res.EnsureSuccessStatusCode();
        var body = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        var access = body.GetProperty("accessToken").GetString()!;

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", access);
        var me = JsonDocument.Parse(await client.GetStringAsync("/v1/me")).RootElement;
        return new TestUser
        {
            Client = client,
            Phone = phone,
            AccessToken = access,
            RefreshToken = body.GetProperty("refreshToken").GetString()!,
            Id = me.GetProperty("id").GetGuid(),
        };
    }

    public static async Task<JsonElement> Json(HttpResponseMessage res) =>
        JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;

    public static string Key() => "key-" + Guid.NewGuid().ToString("N");
}
