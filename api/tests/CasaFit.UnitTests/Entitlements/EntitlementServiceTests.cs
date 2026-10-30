using CasaFit.Application.Common;
using CasaFit.Application.Entitlements;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CasaFit.UnitTests.Entitlements;

public class EntitlementServiceTests
{
    private static readonly Guid Account = Guid.NewGuid();
    private readonly FakeEntitlementStore _store = new();
    private readonly EntitlementService _sut;

    public EntitlementServiceTests() =>
        _sut = new EntitlementService(_store, _store, TimeProvider.System, NullLogger<EntitlementService>.Instance);

    private static ConsumeRequest Consume(string key) => new() { IdempotencyKey = key, Exercise = "squat" };
    private static RefundRequest Refund(string key, string consumeKey, int reps = 1) =>
        new() { IdempotencyKey = key, ConsumeIdempotencyKey = consumeKey, RepsCompleted = reps };

    [Fact]
    public async Task Consume_spends_one_and_reports_the_balance()
    {
        var res = await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        Assert.True(res.Ok);
        Assert.Equal(1, res.FreeChecksRemaining);
    }

    [Fact]
    public async Task Consume_replay_with_the_same_key_does_not_spend_again()
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        var again = await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        Assert.True(again.Ok);
        Assert.Equal(1, again.FreeChecksRemaining);
        Assert.Equal(1, _store.Balance);
    }

    [Fact]
    public async Task Credit_never_goes_below_zero_and_the_failed_key_is_not_burned()
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        await _sut.ConsumeAsync(Account, Consume("consume-key-000002"), default);

        var third = await _sut.ConsumeAsync(Account, Consume("consume-key-000003"), default);

        Assert.False(third.Ok);
        Assert.Equal("no_credits", third.Reason);
        Assert.Equal(0, _store.Balance);
        Assert.DoesNotContain((CasaFit.Domain.Entitlements.FormCheckKind.Consume, "consume-key-000003"), _store.Events);
    }

    [Fact]
    public async Task Credit_never_resets_by_any_sequence_of_calls()
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        await _sut.ConsumeAsync(Account, Consume("consume-key-000002"), default);
        // Replaying old keys, asking again and refunding with a closed window all leave the balance at zero.
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        await Assert.ThrowsAsync<DomainException>(() => _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-000001", 3), default));
        Assert.Equal(0, _store.Balance);
    }

    [Fact]
    public async Task Pro_accounts_are_not_charged()
    {
        _store.ProActive = true;
        _store.ProExpiresAt = DateTimeOffset.UtcNow.AddDays(30);

        var res = await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);

        Assert.False(res.Ok);
        Assert.Equal("pro_active", res.Reason);
        Assert.Equal(2, _store.Balance);
    }

    [Fact]
    public async Task An_expired_pro_account_is_charged_like_a_free_account()
    {
        _store.ProActive = true;
        _store.ProExpiresAt = DateTimeOffset.UtcNow.AddDays(-1);
        var res = await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        Assert.True(res.Ok);
        Assert.Equal(1, _store.Balance);
    }

    [Fact]
    public async Task Refund_before_rep_3_gives_the_credit_back()
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        var res = await _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-000001", 2), default);
        Assert.Equal(2, res.FreeChecksRemaining);
    }

    [Theory]
    [InlineData(3)]
    [InlineData(10)]
    public async Task Refund_at_or_after_rep_3_is_refused(int reps)
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        var ex = await Assert.ThrowsAsync<DomainException>(
            () => _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-000001", reps), default));
        Assert.Equal("refund_window_closed", ex.Code);
        Assert.Equal(409, ex.Status);
        Assert.Equal(1, _store.Balance);
    }

    [Fact]
    public async Task Refund_replay_with_the_same_key_does_not_add_a_second_credit()
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        await _sut.ConsumeAsync(Account, Consume("consume-key-000002"), default);
        await _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-000001"), default);
        var again = await _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-000001"), default);
        Assert.Equal(1, again.FreeChecksRemaining);
    }

    [Fact]
    public async Task One_consume_can_be_refunded_only_once_even_with_a_new_key()
    {
        await _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default);
        await _sut.ConsumeAsync(Account, Consume("consume-key-000002"), default);
        await _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-000001"), default);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => _sut.RefundAsync(Account, Refund("refund-key-0000002", "consume-key-000001"), default));

        Assert.Equal("already_refunded", ex.Code);
        Assert.Equal(1, _store.Balance);
    }

    [Fact]
    public async Task Refund_without_a_matching_consume_is_refused_and_never_exceeds_two()
    {
        var ex = await Assert.ThrowsAsync<DomainException>(
            () => _sut.RefundAsync(Account, Refund("refund-key-0000001", "consume-key-nothing01"), default));
        Assert.Equal("unknown_consume", ex.Code);
        Assert.Equal(2, _store.Balance);
    }

    [Fact]
    public async Task A_deleted_account_gets_401()
    {
        _store.AccountExists = false;
        var ex = await Assert.ThrowsAsync<DomainException>(() => _sut.ConsumeAsync(Account, Consume("consume-key-000001"), default));
        Assert.Equal(401, ex.Status);
    }

    // RevenueCat webhook service

    private RevenueCatWebhookService Webhook(string secret = "s3cret") => new(
        _store, Options.Create(new RevenueCatOptions { WebhookSecret = secret }), NullLogger<RevenueCatWebhookService>.Instance);

    private static RevenueCatEvent Event(string id, string type, long at, long? expires = null, string? user = null) => new()
    {
        Id = id, Type = type, AppUserId = user ?? Account.ToString(), EventTimestampMs = at, ExpirationAtMs = expires,
    };

    [Theory]
    [InlineData("s3cret", true)]
    [InlineData("Bearer s3cret", false)]
    [InlineData("wrong", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Webhook_authentication_uses_the_shared_secret(string? header, bool expected) =>
        Assert.Equal(expected, Webhook().IsAuthentic(header));

    [Fact]
    public void Webhook_with_no_configured_secret_rejects_everything() =>
        Assert.False(Webhook("").IsAuthentic(""));

    [Fact]
    public async Task Purchase_event_turns_pro_on_with_the_expiry()
    {
        var expiry = DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeMilliseconds();
        var ack = await Webhook().HandleAsync(Event("e1", "INITIAL_PURCHASE", 1000, expiry), default);
        Assert.True(ack.Processed);
        Assert.True(_store.ProActive);
        Assert.Equal(expiry, _store.ProExpiresAt!.Value.ToUnixTimeMilliseconds());
    }

    [Fact]
    public async Task Webhook_replay_of_the_same_event_id_changes_nothing()
    {
        await Webhook().HandleAsync(Event("e1", "INITIAL_PURCHASE", 1000, 5000), default);
        _store.ProActive = false; // would flip back if the replay were applied again
        var ack = await Webhook().HandleAsync(Event("e1", "INITIAL_PURCHASE", 1000, 5000), default);
        Assert.False(ack.Processed);
        Assert.Equal("duplicate", ack.Outcome);
        Assert.False(_store.ProActive);
    }

    [Fact]
    public async Task Expiration_event_turns_pro_off()
    {
        await Webhook().HandleAsync(Event("e1", "INITIAL_PURCHASE", 1000, 5000), default);
        await Webhook().HandleAsync(Event("e2", "EXPIRATION", 2000, 2000), default);
        Assert.False(_store.ProActive);
    }

    [Fact]
    public async Task An_older_event_delivered_late_is_ignored()
    {
        await Webhook().HandleAsync(Event("e2", "EXPIRATION", 2000, 2000), default);
        var ack = await Webhook().HandleAsync(Event("e1", "INITIAL_PURCHASE", 1000, 99999999999), default);
        Assert.Equal("stale", ack.Outcome);
        Assert.False(_store.ProActive);
    }

    [Theory]
    [InlineData("TEST")]
    [InlineData("CANCELLATION")]
    [InlineData("BILLING_ISSUE")]
    public async Task Event_types_we_do_not_act_on_are_acknowledged_and_ignored(string type)
    {
        var ack = await Webhook().HandleAsync(Event("e1", type, 1000), default);
        Assert.False(ack.Processed);
        Assert.False(_store.ProActive);
    }

    [Fact]
    public async Task Unknown_or_anonymous_app_user_is_acknowledged_without_error()
    {
        var anon = await Webhook().HandleAsync(Event("e1", "INITIAL_PURCHASE", 1000, user: "$RCAnonymousID:abc"), default);
        _store.AccountExists = false;
        var gone = await Webhook().HandleAsync(Event("e2", "INITIAL_PURCHASE", 1000), default);
        Assert.False(anon.Processed);
        Assert.Equal("unknown_account", gone.Outcome);
    }
}
