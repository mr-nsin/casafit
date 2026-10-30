using System.Net;
using System.Text.Json;
using CasaFit.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace CasaFit.IntegrationTests;

[Collection(ApiCollection.Name)]
public class SupabaseAuthTests(ApiFactory factory)
{
    [Fact]
    public async Task No_token_is_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await TestUser.ClientFor(factory, null).GetAsync("/v1/me")).StatusCode);
    }

    [Fact]
    public async Task The_old_auth_endpoints_are_gone()
    {
        var client = TestUser.ClientFor(factory, null);
        foreach (var path in new[] { "/v1/auth/code", "/v1/auth/verify", "/v1/auth/refresh" })
        {
            var res = await client.PostAsync(path, new StringContent("{}"));
            Assert.True(res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized, path);
        }
    }

    public static IEnumerable<object[]> BadTokens() =>
    [
        ["wrong secret", TestTokens.Create(email: "a@example.com", secret: "another-secret-another-secret-another-secret")],
        ["wrong issuer", TestTokens.Create(email: "a@example.com", issuer: "https://evil.example/auth/v1")],
        ["wrong audience", TestTokens.Create(email: "a@example.com", audience: "anon")],
        ["expired", TestTokens.Create(email: "a@example.com", expires: DateTime.UtcNow.AddMinutes(-5))],
        ["other HMAC algorithm", TestTokens.Create(email: "a@example.com", secret: TestTokens.Secret + TestTokens.Secret, algorithm: SecurityAlgorithms.HmacSha512)],
        ["garbage", "not.a.token"],
    ];

    [Theory]
    [MemberData(nameof(BadTokens))]
    public async Task A_bad_token_is_401(string why, string token)
    {
        var res = await TestUser.ClientFor(factory, token).GetAsync("/v1/me");
        Assert.True(res.StatusCode == HttpStatusCode.Unauthorized, why);
    }

    [Fact]
    public async Task A_token_that_expired_20_seconds_ago_is_accepted_within_the_30_second_skew()
    {
        var token = TestTokens.Create(email: TestUser.NewEmail(), expires: DateTime.UtcNow.AddSeconds(-20));
        Assert.Equal(HttpStatusCode.OK, (await TestUser.ClientFor(factory, token).GetAsync("/v1/me")).StatusCode);
    }

    [Theory]
    [InlineData("email")]
    [InlineData("google")]
    [InlineData("apple")]
    [InlineData("facebook")]
    public async Task The_first_request_provisions_the_account_with_email_and_provider(string provider)
    {
        var email = $"Mixed.Case{Guid.NewGuid():N}@Example.com";
        var user = await TestUser.SignInAsync(factory, email: email, provider: provider);

        var me = await TestUser.Json(await user.Client.GetAsync("/v1/me"));

        Assert.Equal(user.Id, me.GetProperty("id").GetGuid());
        Assert.Equal(email.ToLowerInvariant(), me.GetProperty("email").GetString());
        Assert.Equal(provider, me.GetProperty("provider").GetString());
        Assert.Equal(2, me.GetProperty("freeChecksRemaining").GetInt32());
        Assert.NotEqual(JsonValueKind.Undefined, me.GetProperty("createdAt").ValueKind);
        var masked = me.GetProperty("emailMasked").GetString()!;
        Assert.StartsWith("m***@", masked);
        Assert.EndsWith("@example.com", masked);
    }

    [Fact]
    public async Task Concurrent_first_requests_create_exactly_one_account()
    {
        var sub = Guid.NewGuid().ToString();
        var token = TestTokens.Create(sub: sub, email: TestUser.NewEmail());

        var results = await Task.WhenAll(Enumerable.Range(0, 12).Select(async _ =>
        {
            var res = await TestUser.ClientFor(factory, token).GetAsync("/v1/me");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            return (await TestUser.Json(res)).GetProperty("id").GetGuid();
        }));

        Assert.Single(results.Distinct());
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CasaFitDbContext>();
        Assert.Equal(1, await db.Accounts.CountAsync(a => a.ExternalId == sub));
    }

    [Fact]
    public async Task A_new_email_or_provider_in_a_later_token_updates_the_account()
    {
        var sub = Guid.NewGuid().ToString();
        var first = await TestUser.SignInAsync(factory, sub: sub, provider: "email");
        var newEmail = TestUser.NewEmail();

        var token = TestTokens.Create(sub: sub, email: newEmail, provider: "google");
        var me = await TestUser.Json(await TestUser.ClientFor(factory, token).GetAsync("/v1/me"));

        Assert.Equal(first.Id, me.GetProperty("id").GetGuid());
        Assert.Equal(newEmail, me.GetProperty("email").GetString());
        Assert.Equal("google", me.GetProperty("provider").GetString());
    }

    [Fact]
    public async Task A_second_supabase_user_with_the_same_email_still_gets_an_account_without_the_email()
    {
        var email = TestUser.NewEmail();
        var one = await TestUser.SignInAsync(factory, email: email);
        var two = await TestUser.SignInAsync(factory, email: email, provider: "apple");

        Assert.NotEqual(one.Id, two.Id);
        var me = await TestUser.Json(await two.Client.GetAsync("/v1/me"));
        Assert.Equal(JsonValueKind.Null, me.GetProperty("email").ValueKind);
    }

    [Fact]
    public async Task A_token_without_an_email_is_accepted()
    {
        var token = TestTokens.Create(email: null, provider: "apple");
        var res = await TestUser.ClientFor(factory, token).GetAsync("/v1/me");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var me = await TestUser.Json(res);
        Assert.Equal(JsonValueKind.Null, me.GetProperty("email").ValueKind);
        Assert.Equal(JsonValueKind.Null, me.GetProperty("emailMasked").ValueKind);
    }
}
