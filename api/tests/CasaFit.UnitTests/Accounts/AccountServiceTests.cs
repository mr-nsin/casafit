using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CasaFit.Application.Accounts;
using CasaFit.Application.Auth;
using CasaFit.Application.Common;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using CasaFit.Domain.Tracking;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace CasaFit.UnitTests.Accounts;

public class AccountServiceTests
{
    private const string Pepper = "unit-test-pepper-0123456789";
    private static readonly Guid Id = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 10, 27, 9, 0, 0, TimeSpan.Zero);

    private sealed class FixedClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private readonly IAccountStore _store = Substitute.For<IAccountStore>();
    private readonly AccountService _sut;

    public AccountServiceTests() =>
        _sut = new AccountService(_store, Options.Create(new AuthOptions { Pepper = Pepper }), new FixedClock(), NullLogger<AccountService>.Instance);

    private static byte[] Hash(string v) => HMACSHA256.HashData(Encoding.UTF8.GetBytes(Pepper), Encoding.UTF8.GetBytes(v));

    [Fact]
    public async Task Delete_keeps_an_hmac_of_each_identifier_for_180_days()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>())
            .Returns(new Account { Id = Id, PhoneE164 = "+919876543210", EmailNorm = "a@example.com" });
        IReadOnlyCollection<DeletedIdentifierHash>? saved = null;
        await _store.DeleteAsync(Id, Arg.Do<IReadOnlyCollection<DeletedIdentifierHash>>(h => saved = h), Arg.Any<CancellationToken>());

        await _sut.DeleteAsync(Id, default);

        Assert.NotNull(saved);
        Assert.Equal(2, saved!.Count);
        Assert.Contains(saved, h => h.Hash.SequenceEqual(Hash("+919876543210")));
        Assert.Contains(saved, h => h.Hash.SequenceEqual(Hash("a@example.com")));
        Assert.All(saved, h =>
        {
            Assert.Equal(Now, h.DeletedAt);
            Assert.Equal(Now.AddDays(180), h.ExpiresAt);
        });
    }

    [Fact]
    public async Task Delete_stores_no_raw_identifier()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>()).Returns(new Account { Id = Id, PhoneE164 = "+919876543210" });
        IReadOnlyCollection<DeletedIdentifierHash>? saved = null;
        await _store.DeleteAsync(Id, Arg.Do<IReadOnlyCollection<DeletedIdentifierHash>>(h => saved = h), Arg.Any<CancellationToken>());

        await _sut.DeleteAsync(Id, default);

        var raw = Encoding.UTF8.GetBytes("+919876543210");
        Assert.All(saved!, h => Assert.False(h.Hash.SequenceEqual(raw)));
    }

    [Fact]
    public async Task Deleting_an_account_that_is_already_gone_does_nothing()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>()).Returns((Account?)null);
        await _sut.DeleteAsync(Id, default);
        await _store.DidNotReceiveWithAnyArgs().DeleteAsync(default, default!, default);
    }

    [Fact]
    public async Task Me_for_a_deleted_account_is_401()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>()).Returns((Account?)null);
        var ex = await Assert.ThrowsAsync<DomainException>(() => _sut.GetMeAsync(Id, default));
        Assert.Equal(401, ex.Status);
    }

    [Fact]
    public async Task Me_reports_pro_as_inactive_once_the_expiry_has_passed()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>())
            .Returns(new Account { Id = Id, ProActive = true, ProExpiresAt = Now.AddDays(-1), FreeChecksRemaining = 1 });
        var me = await _sut.GetMeAsync(Id, default);
        Assert.False(me.Pro.Active);
        Assert.Equal(1, me.FreeChecksRemaining);
    }

    [Fact]
    public async Task Consent_is_recorded_with_the_server_time()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>()).Returns(new Account { Id = Id });
        var res = await _sut.RecordConsentAsync(Id, new RecordConsentRequest { Type = "health_sync", Granted = true, PolicyVersion = "2026-10" }, default);
        Assert.Equal(Now, res.RecordedAt);
        await _store.Received(1).AddConsentAsync(
            Arg.Is<ConsentRecord>(c => c.AccountId == Id && c.Type == "health_sync" && c.Granted), Arg.Any<CancellationToken>());
    }
}

public class SyncServiceTests
{
    private readonly IAccountStore _store = Substitute.For<IAccountStore>();
    private readonly SyncService _sut;
    private static readonly Guid Id = Guid.NewGuid();

    public SyncServiceTests()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>()).Returns(new Account { Id = Id });
        _sut = new SyncService(_store, NullLogger<SyncService>.Instance);
    }

    [Theory]
    [InlineData(0, 60)]
    [InlineData(-5, 60)]
    [InlineData(59, 60)]
    [InlineData(60, 60)]
    [InlineData(900, 900)]
    [InlineData(3600, 3600)]
    [InlineData(3601, 3600)]
    [InlineData(86_400, 3600)]
    public void Duration_is_clamped_to_60_to_3600(int input, int expected) =>
        Assert.Equal(expected, SyncService.ClampDuration(input));

    [Fact]
    public async Task Sessions_are_stored_clamped_and_the_response_counts_them()
    {
        IReadOnlyCollection<SessionLog>? saved = null;
        await _store.UpsertSessionsAsync(Id, Arg.Do<IReadOnlyCollection<SessionLog>>(r => saved = r), Arg.Any<CancellationToken>());
        _store.UpsertSessionsAsync(Id, Arg.Any<IReadOnlyCollection<SessionLog>>(), Arg.Any<CancellationToken>()).Returns(2);

        SessionEntry E(int d) => new()
        {
            Id = Guid.NewGuid(), PlanWeek = 1, PlanDay = 1, Style = "normal", DurationS = d, Felt = "easy", CompletedAt = DateTimeOffset.UtcNow,
        };
        var res = await _sut.SyncSessionsAsync(Id, new SyncSessionsRequest { Entries = [E(5), E(900)] }, default);

        Assert.Equal(new[] { 60, 900 }, saved!.Select(s => s.DurationS).ToArray());
        Assert.Equal(1, res.Clamped);
        Assert.Equal(2, res.Received);
    }

    [Fact]
    public async Task Duplicate_ids_in_one_batch_are_stored_once()
    {
        IReadOnlyCollection<SessionLog>? saved = null;
        await _store.UpsertSessionsAsync(Id, Arg.Do<IReadOnlyCollection<SessionLog>>(r => saved = r), Arg.Any<CancellationToken>());
        var same = Guid.NewGuid();
        SessionEntry E() => new() { Id = same, PlanWeek = 1, PlanDay = 1, Style = "yoga", DurationS = 600, Felt = "hard", CompletedAt = DateTimeOffset.UtcNow };
        await _sut.SyncSessionsAsync(Id, new SyncSessionsRequest { Entries = [E(), E()] }, default);
        Assert.Single(saved!);
    }

    [Fact]
    public async Task Steps_for_the_same_date_keep_the_last_entry()
    {
        IReadOnlyCollection<StepSummary>? saved = null;
        await _store.UpsertStepsAsync(Id, Arg.Do<IReadOnlyCollection<StepSummary>>(r => saved = r), Arg.Any<CancellationToken>());
        var d = new DateOnly(2026, 10, 27);
        await _sut.SyncStepsAsync(Id, new SyncStepsRequest
        {
            Entries = [new StepEntry { Date = d, Steps = 100 }, new StepEntry { Date = d, Steps = 900 }],
        }, default);
        Assert.Equal(900, Assert.Single(saved!).Steps);
    }

    [Fact]
    public async Task Sync_for_a_deleted_account_is_401()
    {
        _store.GetAsync(Id, Arg.Any<CancellationToken>()).Returns((Account?)null);
        await Assert.ThrowsAsync<DomainException>(() =>
            _sut.SyncFoodAsync(Id, new SyncFoodRequest { Entries = [new FoodEntryDto { Id = Guid.NewGuid() }] }, default));
    }
}

public class PlanValidationTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private readonly UpsertPlanRequestValidator _v = new();

    private static UpsertPlanRequest Parse(string json) => JsonSerializer.Deserialize<UpsertPlanRequest>(json, Web)!;

    private const string Good = """{"goal":"stay_fit","styles":3,"days":4,"experience":"new","variant":"gentle_start"}""";

    [Fact]
    public void A_plan_with_only_the_allowed_fields_is_valid() => Assert.True(_v.Validate(Parse(Good)).IsValid);

    [Theory]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"new","variant":"v1","health":["heart_bp"]}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"new","variant":"v1","pain":["knees"]}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"new","variant":"v1","ageYears":40,"heightCm":170}""")]
    public void Any_extra_field_such_as_health_is_rejected(string json)
    {
        var result = _v.Validate(Parse(json));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Unknown");
    }

    [Theory]
    [InlineData("""{"goal":"nope","styles":1,"days":4,"experience":"new","variant":"v1"}""")]
    [InlineData("""{"goal":"stay_fit","styles":0,"days":4,"experience":"new","variant":"v1"}""")]
    [InlineData("""{"goal":"stay_fit","styles":8,"days":4,"experience":"new","variant":"v1"}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":2,"experience":"new","variant":"v1"}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":8,"experience":"new","variant":"v1"}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"pro","variant":"v1"}""")]
    [InlineData("""{"goal":"stay_fit","styles":1,"days":4,"experience":"new","variant":"Bad Variant!"}""")]
    public void Out_of_range_values_are_rejected(string json) => Assert.False(_v.Validate(Parse(json)).IsValid);
}

public class RefreshServiceTests
{
    private readonly ITokenService _tokens = Substitute.For<ITokenService>();
    private readonly IAccountStore _accounts = Substitute.For<IAccountStore>();

    [Fact]
    public async Task A_valid_refresh_token_returns_a_new_pair()
    {
        var id = Guid.NewGuid();
        _tokens.ValidateRefreshAsync("r").Returns(id);
        _tokens.Issue(id).Returns(new TokenPair("a2", "r2"));
        _accounts.GetAsync(id, Arg.Any<CancellationToken>()).Returns(new Account { Id = id });

        var pair = await new RefreshService(_tokens, _accounts).RefreshAsync(new RefreshRequest { RefreshToken = "r" }, default);

        Assert.Equal("a2", pair.AccessToken);
    }

    [Fact]
    public async Task An_invalid_token_or_deleted_account_is_401()
    {
        _tokens.ValidateRefreshAsync("bad").Returns((Guid?)null);
        var sut = new RefreshService(_tokens, _accounts);
        var ex = await Assert.ThrowsAsync<DomainException>(() => sut.RefreshAsync(new RefreshRequest { RefreshToken = "bad" }, default));
        Assert.Equal("invalid_refresh", ex.Code);

        var id = Guid.NewGuid();
        _tokens.ValidateRefreshAsync("gone").Returns(id);
        _accounts.GetAsync(id, Arg.Any<CancellationToken>()).Returns((Account?)null);
        await Assert.ThrowsAsync<DomainException>(() => sut.RefreshAsync(new RefreshRequest { RefreshToken = "gone" }, default));
    }
}
