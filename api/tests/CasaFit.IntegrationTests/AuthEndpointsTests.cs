using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace CasaFit.IntegrationTests;

[Collection(ApiCollection.Name)]
public class AuthEndpointsTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    // Each test uses its own number so the hourly and resend counters never collide.
    private static string NewPhone() => "9" + Random.Shared.NextInt64(100_000_000, 999_999_999);

    private static string E164(string phone) => "+91" + phone;

    private static async Task<JsonElement> Json(HttpResponseMessage res) =>
        JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Code_returns_200_with_resend_timing()
    {
        var res = await _client.PostAsJsonAsync("/v1/auth/code", new { phone = NewPhone() });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await Json(res);
        Assert.Equal(30, body.GetProperty("resendInSeconds").GetInt32());
        Assert.Equal(4, body.GetProperty("attemptsLeftThisHour").GetInt32());
    }

    [Fact]
    public async Task Code_rejects_both_phone_and_email_with_400_problem_details()
    {
        var res = await _client.PostAsJsonAsync("/v1/auth/code", new { phone = NewPhone(), email = "x@y.com" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Code_rejects_disposable_email()
    {
        var res = await _client.PostAsJsonAsync("/v1/auth/code", new { email = "x@mailinator.com" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Second_code_request_inside_30_seconds_does_not_send_again()
    {
        var phone = NewPhone();
        await _client.PostAsJsonAsync("/v1/auth/code", new { phone });
        var first = factory.Outbox.LastCodeFor(E164(phone));

        var res = await _client.PostAsJsonAsync("/v1/auth/code", new { phone });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await Json(res);
        Assert.InRange(body.GetProperty("resendInSeconds").GetInt32(), 1, 30);
        Assert.Equal(first, factory.Outbox.LastCodeFor(E164(phone)));
    }

    [Fact]
    public async Task Verify_with_a_wrong_code_returns_401_with_a_code()
    {
        var phone = NewPhone();
        await _client.PostAsJsonAsync("/v1/auth/code", new { phone });
        var sent = factory.Outbox.LastCodeFor(E164(phone));
        var wrong = sent == "000000" ? "111111" : "000000";

        var res = await _client.PostAsJsonAsync("/v1/auth/verify", new { phone, code = wrong });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("wrong", (await Json(res)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Verify_rejects_a_malformed_code_with_400()
    {
        var res = await _client.PostAsJsonAsync("/v1/auth/verify", new { phone = NewPhone(), code = "12" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Verify_with_the_right_code_creates_the_account_then_recognises_it()
    {
        var phone = NewPhone();

        await _client.PostAsJsonAsync("/v1/auth/code", new { phone });
        var first = await _client.PostAsJsonAsync("/v1/auth/verify", new { phone, code = factory.Outbox.LastCodeFor(E164(phone)) });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var firstBody = await Json(first);
        Assert.True(firstBody.GetProperty("isNewAccount").GetBoolean());
        Assert.Equal(2, firstBody.GetProperty("freeChecksRemaining").GetInt32());
        Assert.False(firstBody.GetProperty("pro").GetProperty("active").GetBoolean());
        Assert.Equal(JsonValueKind.Null, firstBody.GetProperty("pro").GetProperty("expiresAt").ValueKind);
        Assert.Equal(3, firstBody.GetProperty("accessToken").GetString()!.Split('.').Length);

        // The code is single use.
        var again = await _client.PostAsJsonAsync("/v1/auth/verify", new { phone, code = "000000" });
        Assert.Equal(HttpStatusCode.Unauthorized, again.StatusCode);
    }

    [Fact]
    public async Task Email_sign_in_works_and_normalises_the_address()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        var typed = $"A.Sha{tag}+gym@Example.com";
        await _client.PostAsJsonAsync("/v1/auth/code", new { email = typed });
        // The dev outbox is keyed by the normalised address: lower-cased, +tag stripped, dots kept (not Gmail).
        var code = factory.Outbox.LastCodeFor($"a.sha{tag}@example.com");
        Assert.NotNull(code);
        var res = await _client.PostAsJsonAsync("/v1/auth/verify", new { email = typed, code });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.True((await Json(res)).GetProperty("isNewAccount").GetBoolean());
    }

    [Fact]
    public async Task Sixth_send_in_an_hour_reports_zero_attempts_left()
    {
        var phone = NewPhone();
        // The 30 s resend lock is real time here, so exercise the cap through the store directly.
        var store = factory.Services.GetRequiredService<CasaFit.Application.Auth.IOtpStore>();
        var key = Convert.ToHexString(System.Security.Cryptography.HMACSHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes("integration-test-pepper-0123456789"),
            System.Text.Encoding.UTF8.GetBytes(E164(phone))));
        for (var i = 0; i < 5; i++) await store.IncrementSendCountAsync(key, default);

        var res = await _client.PostAsJsonAsync("/v1/auth/code", new { phone });
        var last = await Json(res);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(0, last.GetProperty("attemptsLeftThisHour").GetInt32());
        Assert.True(last.GetProperty("resendInSeconds").GetInt32() > 30);
        Assert.Null(factory.Outbox.LastCodeFor(E164(phone)));
    }
}
