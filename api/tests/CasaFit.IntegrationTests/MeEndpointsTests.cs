using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using CasaFit.Application.Auth;
using CasaFit.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CasaFit.IntegrationTests;

[Collection(ApiCollection.Name)]
public class MeEndpointsTests(ApiFactory factory)
{
    private static readonly object GoodPlan = new { goal = "stay_fit", styles = 3, days = 4, experience = "new", variant = "gentle_start" };

    [Fact]
    public async Task Me_requires_a_token()
    {
        var res = await factory.CreateClient().GetAsync("/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Me_returns_the_account_summary_with_two_free_checks_and_no_plan()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.GetAsync("/v1/me");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await TestUser.Json(res);
        Assert.Equal(2, body.GetProperty("freeChecksRemaining").GetInt32());
        Assert.False(body.GetProperty("onboarded").GetBoolean());
        Assert.False(body.GetProperty("pro").GetProperty("active").GetBoolean());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, body.GetProperty("plan").ValueKind);
    }

    [Fact]
    public async Task Put_plan_stores_the_plan_then_me_shows_it_and_the_account_is_onboarded()
    {
        var user = await TestUser.SignInAsync(factory);
        var put = await user.Client.PutAsJsonAsync("/v1/me/plan", GoodPlan);
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Equal(1, (await TestUser.Json(put)).GetProperty("weekNumber").GetInt32());

        var me = await TestUser.Json(await user.Client.GetAsync("/v1/me"));
        Assert.True(me.GetProperty("onboarded").GetBoolean());
        Assert.Equal("gentle_start", me.GetProperty("plan").GetProperty("variant").GetString());

        // A second put replaces, and keeps one row.
        var again = await user.Client.PutAsJsonAsync("/v1/me/plan", new { goal = "gentler", styles = 2, days = 3, experience = "regular", variant = "v2" });
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal("gentler", (await TestUser.Json(again)).GetProperty("goal").GetString());
    }

    [Theory]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"new","variant":"v1","health":["heart_bp"]}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"new","variant":"v1","pain":["knees"]}""")]
    public async Task Put_plan_rejects_health_fields_with_400(string json)
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.PutAsync("/v1/me/plan", new StringContent(json, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Put_plan_rejects_out_of_range_days()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.PutAsJsonAsync("/v1/me/plan", new { goal = "stay_fit", styles = 1, days = 9, experience = "new", variant = "v1" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Put_plan_requires_a_token()
    {
        var res = await factory.CreateClient().PutAsJsonAsync("/v1/me/plan", GoodPlan);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Consent_is_recorded_and_appears_in_the_export()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.PostAsJsonAsync("/v1/me/consents", new { type = "health_sync", granted = true, policyVersion = "2026-10" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var export = await TestUser.Json(await user.Client.PostAsync("/v1/me/export", null));
        var consent = Assert.Single(export.GetProperty("consents").EnumerateArray());
        Assert.Equal("health_sync", consent.GetProperty("type").GetString());
    }

    [Fact]
    public async Task Consent_rejects_an_unknown_type()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.PostAsJsonAsync("/v1/me/consents", new { type = "sell_my_data", granted = true, policyVersion = "1" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Export_contains_account_plan_and_synced_logs()
    {
        var user = await TestUser.SignInAsync(factory);
        await user.Client.PutAsJsonAsync("/v1/me/plan", GoodPlan);
        await user.Client.PostAsJsonAsync("/v1/me/sync/steps", new { entries = new[] { new { date = "2026-10-26", steps = 8000, briskMinutes = 20 } } });

        var res = await user.Client.PostAsync("/v1/me/export", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await TestUser.Json(res);
        Assert.Equal(user.Id, body.GetProperty("account").GetProperty("id").GetGuid());
        Assert.Equal("gentle_start", body.GetProperty("plan").GetProperty("variant").GetString());
        Assert.Equal(8000, Assert.Single(body.GetProperty("steps").EnumerateArray()).GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task Delete_removes_the_account_and_keeps_the_hash_so_signing_up_again_restores_no_credits()
    {
        var user = await TestUser.SignInAsync(factory);
        await user.Client.PutAsJsonAsync("/v1/me/plan", GoodPlan);

        var del = await user.Client.DeleteAsync("/v1/me");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);

        // The old token no longer works for the account.
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.Client.GetAsync("/v1/me")).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CasaFitDbContext>();
            Assert.False(await db.Accounts.AnyAsync(a => a.Id == user.Id));
            Assert.False(await db.Plans.AnyAsync(p => p.AccountId == user.Id));
            var hash = PhoneHash(user.Phone);
            var row = await db.DeletedIdentifierHashes.SingleAsync(h => h.Hash == hash);
            Assert.Equal(180, Math.Round((row.ExpiresAt - row.DeletedAt).TotalDays));
        }

        // Sign up again with the same phone: a new account with no free checks.
        var again = await SignUpAgainAsync(user.Phone);
        Assert.True(again.GetProperty("isNewAccount").GetBoolean());
        Assert.Equal(0, again.GetProperty("freeChecksRemaining").GetInt32());
    }

    [Fact]
    public async Task Delete_twice_is_still_204()
    {
        var user = await TestUser.SignInAsync(factory);
        await user.Client.DeleteAsync("/v1/me");
        Assert.Equal(HttpStatusCode.NoContent, (await user.Client.DeleteAsync("/v1/me")).StatusCode);
    }

    [Fact]
    public async Task Sync_sessions_clamps_duration_and_skips_ids_already_stored()
    {
        var user = await TestUser.SignInAsync(factory);
        var short1 = Guid.NewGuid();
        var long1 = Guid.NewGuid();
        object Entry(Guid id, int d) => new
        {
            id, planWeek = 1, planDay = 2, style = "normal", durationS = d, felt = "easy", completedAt = DateTimeOffset.UtcNow,
        };

        var res = await user.Client.PostAsJsonAsync("/v1/me/sync/sessions", new { entries = new[] { Entry(short1, 5), Entry(long1, 99_999) } });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await TestUser.Json(res);
        Assert.Equal(2, body.GetProperty("stored").GetInt32());
        Assert.Equal(2, body.GetProperty("clamped").GetInt32());

        var replay = await TestUser.Json(await user.Client.PostAsJsonAsync("/v1/me/sync/sessions", new { entries = new[] { Entry(short1, 5) } }));
        Assert.Equal(0, replay.GetProperty("stored").GetInt32());

        var export = await TestUser.Json(await user.Client.PostAsync("/v1/me/export", null));
        var durations = export.GetProperty("sessions").EnumerateArray().Select(s => s.GetProperty("durationS").GetInt32()).Order().ToArray();
        Assert.Equal(new[] { 60, 3600 }, durations);
    }

    [Fact]
    public async Task Sync_sessions_rejects_a_bad_style_and_an_empty_batch()
    {
        var user = await TestUser.SignInAsync(factory);
        var bad = await user.Client.PostAsJsonAsync("/v1/me/sync/sessions", new
        {
            entries = new[] { new { id = Guid.NewGuid(), planWeek = 1, planDay = 1, style = "boxing", durationS = 600, felt = "easy", completedAt = DateTimeOffset.UtcNow } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var empty = await user.Client.PostAsJsonAsync("/v1/me/sync/sessions", new { entries = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
    }

    [Fact]
    public async Task Sync_steps_upserts_by_date()
    {
        var user = await TestUser.SignInAsync(factory);
        await user.Client.PostAsJsonAsync("/v1/me/sync/steps", new { entries = new[] { new { date = "2026-10-25", steps = 100, briskMinutes = 1 } } });
        var res = await user.Client.PostAsJsonAsync("/v1/me/sync/steps", new { entries = new[] { new { date = "2026-10-25", steps = 9000, briskMinutes = 30 } } });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var export = await TestUser.Json(await user.Client.PostAsync("/v1/me/export", null));
        Assert.Equal(9000, Assert.Single(export.GetProperty("steps").EnumerateArray()).GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task Sync_steps_rejects_negative_steps()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.PostAsJsonAsync("/v1/me/sync/steps", new { entries = new[] { new { date = "2026-10-25", steps = -1, briskMinutes = 1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Sync_food_upserts_by_id()
    {
        var user = await TestUser.SignInAsync(factory);
        var id = Guid.NewGuid();
        object Entry(decimal portions) => new { id, loggedOn = "2026-10-26", meal = "lunch", foodId = "dal_tadka_katori", portions };

        await user.Client.PostAsJsonAsync("/v1/me/sync/food", new { entries = new[] { Entry(1m) } });
        var res = await user.Client.PostAsJsonAsync("/v1/me/sync/food", new { entries = new[] { Entry(1.5m) } });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var export = await TestUser.Json(await user.Client.PostAsync("/v1/me/export", null));
        Assert.Equal(1.5m, Assert.Single(export.GetProperty("food").EnumerateArray()).GetProperty("portions").GetDecimal());
    }

    [Fact]
    public async Task Sync_food_rejects_zero_portions()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.PostAsJsonAsync("/v1/me/sync/food", new
        {
            entries = new[] { new { id = Guid.NewGuid(), loggedOn = "2026-10-26", meal = "lunch", foodId = "dal", portions = 0m } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Theory]
    [InlineData("/v1/me/sync/steps")]
    [InlineData("/v1/me/sync/sessions")]
    [InlineData("/v1/me/sync/food")]
    [InlineData("/v1/me/consents")]
    [InlineData("/v1/me/export")]
    public async Task Me_posts_require_a_token(string path)
    {
        var res = await factory.CreateClient().PostAsJsonAsync(path, new { });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    private static byte[] PhoneHash(string phone) => HMACSHA256.HashData(
        Encoding.UTF8.GetBytes("integration-test-pepper-0123456789"), Encoding.UTF8.GetBytes("+91" + phone));

    /// <summary>The 30 second resend lock is real time, so plant a known code straight in the OTP store.</summary>
    private async Task<System.Text.Json.JsonElement> SignUpAgainAsync(string phone)
    {
        var pepper = Encoding.UTF8.GetBytes("integration-test-pepper-0123456789");
        var key = Convert.ToHexString(PhoneHash(phone));
        var codeHash = HMACSHA256.HashData(pepper, Encoding.UTF8.GetBytes($"{key}:123456"));
        await factory.Services.GetRequiredService<IOtpStore>().SaveCodeAsync(key, codeHash, TimeSpan.FromMinutes(5), default);

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var res = await client.PostAsJsonAsync("/v1/auth/verify", new { phone, code = "123456" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await TestUser.Json(res);
    }
}
