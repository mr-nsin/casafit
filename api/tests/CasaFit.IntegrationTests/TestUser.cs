using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CasaFit.IntegrationTests;

/// <summary>A signed-in test user: a Supabase-shaped token, and an HttpClient carrying it.</summary>
public sealed class TestUser
{
    public required HttpClient Client { get; init; }
    public required string Sub { get; init; }
    public required string Email { get; init; }
    public required string AccessToken { get; init; }
    public required Guid Id { get; init; }

    public static string NewEmail() => $"user{Guid.NewGuid():N}@example.com";

    public static HttpClient ClientFor(ApiFactory factory, string? token)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        if (token is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>The first request provisions the account, as in production.</summary>
    public static async Task<TestUser> SignInAsync(ApiFactory factory, string? email = null, string provider = "email", string? sub = null)
    {
        email ??= NewEmail();
        sub ??= Guid.NewGuid().ToString();
        var token = TestTokens.Create(sub: sub, email: email, provider: provider);
        var client = ClientFor(factory, token);
        var me = JsonDocument.Parse(await client.GetStringAsync("/v1/me")).RootElement;
        return new TestUser
        {
            Client = client,
            Sub = sub,
            Email = email,
            AccessToken = token,
            Id = me.GetProperty("id").GetGuid(),
        };
    }

    public static async Task<JsonElement> Json(HttpResponseMessage res) =>
        JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;

    public static string Key() => "key-" + Guid.NewGuid().ToString("N");
}
