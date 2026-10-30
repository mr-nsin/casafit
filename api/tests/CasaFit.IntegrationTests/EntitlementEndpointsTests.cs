using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CasaFit.IntegrationTests;

[Collection(ApiCollection.Name)]
public class EntitlementEndpointsTests(ApiFactory factory)
{
    private const string Consume = "/v1/entitlements/form-check/consume";
    private const string Refund = "/v1/entitlements/form-check/refund";

    private static object ConsumeBody(string key) => new { idempotencyKey = key, exercise = "squat" };

    [Fact]
    public async Task Consume_spends_a_credit_and_replay_with_the_same_key_does_not_spend_again()
    {
        var user = await TestUser.SignInAsync(factory);
        var key = TestUser.Key();

        var first = await TestUser.Json(await user.Client.PostAsJsonAsync(Consume, ConsumeBody(key)));
        Assert.True(first.GetProperty("ok").GetBoolean());
        Assert.Equal(1, first.GetProperty("freeChecksRemaining").GetInt32());

        var replay = await TestUser.Json(await user.Client.PostAsJsonAsync(Consume, ConsumeBody(key)));
        Assert.True(replay.GetProperty("ok").GetBoolean());
        Assert.Equal(1, replay.GetProperty("freeChecksRemaining").GetInt32());
    }

    [Fact]
    public async Task Third_consume_returns_no_credits_with_200_and_the_balance_stays_zero()
    {
        var user = await TestUser.SignInAsync(factory);
        await user.Client.PostAsJsonAsync(Consume, ConsumeBody(TestUser.Key()));
        await user.Client.PostAsJsonAsync(Consume, ConsumeBody(TestUser.Key()));

        var res = await user.Client.PostAsJsonAsync(Consume, ConsumeBody(TestUser.Key()));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await TestUser.Json(res);
        Assert.False(body.GetProperty("ok").GetBoolean());
        Assert.Equal("no_credits", body.GetProperty("reason").GetString());
        var status = await TestUser.Json(await user.Client.GetAsync("/v1/me/entitlements"));
        Assert.Equal(0, status.GetProperty("freeChecksRemaining").GetInt32());
    }

    [Fact]
    public async Task Concurrent_consumes_with_different_keys_never_spend_more_than_two()
    {
        var user = await TestUser.SignInAsync(factory);
        var results = await Task.WhenAll(Enumerable.Range(0, 6)
            .Select(_ => user.Client.PostAsJsonAsync(Consume, ConsumeBody(TestUser.Key()))));
        var bodies = await Task.WhenAll(results.Select(TestUser.Json));
        Assert.Equal(2, bodies.Count(b => b.GetProperty("ok").GetBoolean()));
        var status = await TestUser.Json(await user.Client.GetAsync("/v1/me/entitlements"));
        Assert.Equal(0, status.GetProperty("freeChecksRemaining").GetInt32());
    }

    [Fact]
    public async Task Consume_validates_the_key_and_exercise()
    {
        var user = await TestUser.SignInAsync(factory);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await user.Client.PostAsJsonAsync(Consume, new { idempotencyKey = "short", exercise = "squat" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await user.Client.PostAsJsonAsync(Consume, new { idempotencyKey = TestUser.Key(), exercise = "burpee" })).StatusCode);
    }

    [Fact]
    public async Task Consume_and_refund_and_entitlements_require_a_token()
    {
        var anon = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync(Consume, ConsumeBody(TestUser.Key()))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anon.PostAsJsonAsync(Refund, new { idempotencyKey = TestUser.Key(), consumeIdempotencyKey = TestUser.Key(), repsCompleted = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/v1/me/entitlements")).StatusCode);
    }

    [Fact]
    public async Task Refund_before_rep_3_returns_the_credit_and_replay_is_idempotent()
    {
        var user = await TestUser.SignInAsync(factory);
        var consumeKey = TestUser.Key();
        var refundKey = TestUser.Key();
        await user.Client.PostAsJsonAsync(Consume, ConsumeBody(consumeKey));

        var body = new { idempotencyKey = refundKey, consumeIdempotencyKey = consumeKey, repsCompleted = 2 };
        var first = await user.Client.PostAsJsonAsync(Refund, body);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(2, (await TestUser.Json(first)).GetProperty("freeChecksRemaining").GetInt32());

        var replay = await TestUser.Json(await user.Client.PostAsJsonAsync(Refund, body));
        Assert.Equal(2, replay.GetProperty("freeChecksRemaining").GetInt32());
    }

    [Fact]
    public async Task Refund_at_rep_3_is_409()
    {
        var user = await TestUser.SignInAsync(factory);
        var consumeKey = TestUser.Key();
        await user.Client.PostAsJsonAsync(Consume, ConsumeBody(consumeKey));

        var res = await user.Client.PostAsJsonAsync(Refund, new { idempotencyKey = TestUser.Key(), consumeIdempotencyKey = consumeKey, repsCompleted = 3 });

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal("refund_window_closed", (await TestUser.Json(res)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Refund_cannot_be_used_twice_for_one_consume_or_without_a_consume()
    {
        var user = await TestUser.SignInAsync(factory);
        var consumeKey = TestUser.Key();
        await user.Client.PostAsJsonAsync(Consume, ConsumeBody(consumeKey));
        await user.Client.PostAsJsonAsync(Refund, new { idempotencyKey = TestUser.Key(), consumeIdempotencyKey = consumeKey, repsCompleted = 0 });

        var second = await user.Client.PostAsJsonAsync(Refund, new { idempotencyKey = TestUser.Key(), consumeIdempotencyKey = consumeKey, repsCompleted = 0 });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("already_refunded", (await TestUser.Json(second)).GetProperty("code").GetString());

        var none = await user.Client.PostAsJsonAsync(Refund, new { idempotencyKey = TestUser.Key(), consumeIdempotencyKey = TestUser.Key(), repsCompleted = 0 });
        Assert.Equal(HttpStatusCode.Conflict, none.StatusCode);
        Assert.Equal("unknown_consume", (await TestUser.Json(none)).GetProperty("code").GetString());
    }

    // RevenueCat webhook

    private HttpClient WebhookClient(string? authorization = ApiFactory.WebhookSecret)
    {
        var c = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        if (authorization is not null) c.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", authorization);
        return c;
    }

    private static StringContent Event(string id, string type, Guid user, long at, long? expires = null) =>
        new($$$"""{"api_version":"1.0","event":{"id":"{{{id}}}","type":"{{{type}}}","app_user_id":"{{{user}}}","event_timestamp_ms":{{{at}}},"expiration_at_ms":{{{expires?.ToString() ?? "null"}}}}}""",
            Encoding.UTF8, "application/json");

    [Fact]
    public async Task Webhook_without_the_secret_is_401_and_changes_nothing()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await WebhookClient(null).PostAsync("/v1/webhooks/revenuecat",
            Event(TestUser.Key(), "INITIAL_PURCHASE", user.Id, 1000, DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeMilliseconds()));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        var wrong = await WebhookClient("Bearer nope").PostAsync("/v1/webhooks/revenuecat", Event(TestUser.Key(), "INITIAL_PURCHASE", user.Id, 1000));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);

        var status = await TestUser.Json(await user.Client.GetAsync("/v1/me/entitlements"));
        Assert.False(status.GetProperty("pro").GetProperty("active").GetBoolean());
    }

    [Fact]
    public async Task Webhook_purchase_turns_pro_on_then_expiration_turns_it_off_and_replays_are_ignored()
    {
        var user = await TestUser.SignInAsync(factory);
        var now = DateTimeOffset.UtcNow;
        var expiry = now.AddDays(30).ToUnixTimeMilliseconds();
        var buyId = TestUser.Key();

        var buy = await WebhookClient().PostAsync("/v1/webhooks/revenuecat",
            Event(buyId, "INITIAL_PURCHASE", user.Id, now.ToUnixTimeMilliseconds(), expiry));
        Assert.Equal(HttpStatusCode.OK, buy.StatusCode);
        Assert.True((await TestUser.Json(buy)).GetProperty("processed").GetBoolean());

        var pro = await TestUser.Json(await user.Client.GetAsync("/v1/me/entitlements"));
        Assert.True(pro.GetProperty("pro").GetProperty("active").GetBoolean());

        // A pro account is not charged.
        var consume = await TestUser.Json(await user.Client.PostAsJsonAsync(Consume, ConsumeBody(TestUser.Key())));
        Assert.Equal("pro_active", consume.GetProperty("reason").GetString());

        var replay = await TestUser.Json(await WebhookClient().PostAsync("/v1/webhooks/revenuecat",
            Event(buyId, "INITIAL_PURCHASE", user.Id, now.ToUnixTimeMilliseconds(), expiry)));
        Assert.False(replay.GetProperty("processed").GetBoolean());
        Assert.Equal("duplicate", replay.GetProperty("outcome").GetString());

        await WebhookClient().PostAsync("/v1/webhooks/revenuecat",
            Event(TestUser.Key(), "EXPIRATION", user.Id, now.AddMinutes(1).ToUnixTimeMilliseconds(), now.AddMinutes(1).ToUnixTimeMilliseconds()));
        var off = await TestUser.Json(await user.Client.GetAsync("/v1/me/entitlements"));
        Assert.False(off.GetProperty("pro").GetProperty("active").GetBoolean());
    }

    [Fact]
    public async Task Webhook_for_an_unknown_user_is_acknowledged_with_200()
    {
        var res = await WebhookClient().PostAsync("/v1/webhooks/revenuecat",
            Event(TestUser.Key(), "INITIAL_PURCHASE", Guid.NewGuid(), 1000, 2000));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("unknown_account", (await TestUser.Json(res)).GetProperty("outcome").GetString());
    }

    [Fact]
    public async Task Webhook_with_a_malformed_body_is_400()
    {
        var res = await WebhookClient().PostAsync("/v1/webhooks/revenuecat",
            new StringContent("""{"event":{"id":"","type":"","app_user_id":""}}""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // Content version and refresh

    [Fact]
    public async Task Content_version_requires_a_token_and_returns_the_pack_versions()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/v1/content/version")).StatusCode);

        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.GetAsync("/v1/content/version");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(1, (await TestUser.Json(res)).GetProperty("foodPack").GetInt32());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("wrong-secret")]
    [InlineData("Bearer " + ApiFactory.WebhookSecret)]
    public async Task Webhook_with_a_missing_or_wrong_header_is_401_problem_json_even_with_a_bad_body(string? header)
    {
        var res = await WebhookClient(header).PostAsync("/v1/webhooks/revenuecat",
            new StringContent("{}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Webhook_with_the_exact_secret_is_accepted()
    {
        var res = await WebhookClient(ApiFactory.WebhookSecret).PostAsync("/v1/webhooks/revenuecat",
            Event(TestUser.Key(), "TEST", Guid.NewGuid(), 1000));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }
}
