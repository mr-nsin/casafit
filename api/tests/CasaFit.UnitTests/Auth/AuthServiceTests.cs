using CasaFit.Application.Auth;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using CasaFit.Infrastructure.Auth;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace CasaFit.UnitTests.Auth;

public class AuthServiceTests
{
    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 10, 27, 9, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now += by;
    }

    private const string Phone = "9876543210";
    private const string PhoneE164 = "+919876543210";

    private readonly ManualClock _clock = new();
    private readonly DevOtpOutbox _outbox = new();
    private readonly IAuthStore _store = Substitute.For<IAuthStore>();
    private readonly IAttestationVerifier _attestation = Substitute.For<IAttestationVerifier>();
    private readonly AuthService _sut;

    public AuthServiceTests()
    {
        _attestation.VerifyAsync(Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns(true);
        _store.GetOrCreateAccountAsync(Arg.Any<IdentifierKind>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(ci => (new Account { Id = Guid.NewGuid(), FreeChecksRemaining = ci.ArgAt<int>(2) }, true));

        var tokens = Substitute.For<ITokenService>();
        tokens.Issue(Arg.Any<Guid>()).Returns(new TokenPair("access", "refresh"));

        _sut = new AuthService(
            new InMemoryOtpStore(_clock),
            new DevOtpSender(_outbox, NullLogger<DevOtpSender>.Instance),
            _attestation,
            _store,
            tokens,
            Options.Create(new AuthOptions { Pepper = "unit-test-pepper-0123456789" }),
            _clock,
            NullLogger<AuthService>.Instance);
    }

    private Task<SendCodeResponse> Send() => _sut.SendCodeAsync(new SendCodeRequest { Phone = Phone }, null, default);

    private Task<VerifyCodeResponse> Verify(string code) =>
        _sut.VerifyAsync(new VerifyCodeRequest { Phone = Phone, Code = code }, default);

    private string SentCode() => _outbox.LastCodeFor(PhoneE164) ?? throw new Xunit.Sdk.XunitException("No code was sent.");

    [Fact]
    public async Task Send_returns_30_second_resend_and_4_attempts_left_and_a_six_digit_code()
    {
        var res = await Send();
        Assert.Equal(30, res.ResendInSeconds);
        Assert.Equal(4, res.AttemptsLeftThisHour);
        Assert.Matches(@"^\d{6}$", SentCode());
    }

    [Fact]
    public async Task Send_inside_30_seconds_does_not_send_a_second_code()
    {
        await Send();
        var first = SentCode();
        _clock.Advance(TimeSpan.FromSeconds(10));

        var res = await Send();

        Assert.Equal(20, res.ResendInSeconds);
        Assert.Equal(first, SentCode());
        await _store.Received(1).RecordOtpAttemptAsync(
            Arg.Is<OtpAttempt>(a => a.Kind == OtpAttemptKind.Send), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Sixth_send_in_an_hour_is_refused()
    {
        for (var i = 0; i < 5; i++)
        {
            await Send();
            _clock.Advance(TimeSpan.FromSeconds(31));
        }

        var sixth = await Send();
        Assert.Equal(0, sixth.AttemptsLeftThisHour);
        Assert.True(sixth.ResendInSeconds > 30);
    }

    [Fact]
    public async Task Send_fails_when_attestation_fails()
    {
        _attestation.VerifyAsync(Arg.Any<string?>(), Arg.Any<CancellationToken>()).Returns(false);
        var ex = await Assert.ThrowsAsync<AuthException>(Send);
        Assert.Equal(403, ex.Status);
    }

    [Fact]
    public async Task Verify_with_the_right_code_creates_an_account_and_returns_tokens()
    {
        await Send();
        var res = await Verify(SentCode());

        Assert.True(res.IsNewAccount);
        Assert.Equal(2, res.FreeChecksRemaining);
        Assert.Equal("access", res.AccessToken);
    }

    [Fact]
    public async Task Verify_gives_no_free_checks_to_a_recently_deleted_identifier()
    {
        _store.IsDeletedIdentifierAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>()).Returns(true);
        await Send();
        var res = await Verify(SentCode());
        Assert.Equal(0, res.FreeChecksRemaining);
    }

    [Fact]
    public async Task Code_works_once()
    {
        await Send();
        var code = SentCode();
        await Verify(code);
        var ex = await Assert.ThrowsAsync<AuthException>(() => Verify(code));
        Assert.Equal("expired", ex.Code);
    }

    [Fact]
    public async Task Three_wrong_codes_then_the_fourth_attempt_has_no_tries_left()
    {
        await Send();
        var wrong = SentCode() == "000000" ? "111111" : "000000";
        for (var i = 0; i < 3; i++)
            Assert.Equal("wrong", (await Assert.ThrowsAsync<AuthException>(() => Verify(wrong))).Code);

        var ex = await Assert.ThrowsAsync<AuthException>(() => Verify(SentCode()));
        Assert.Equal("no_tries_left", ex.Code);
        Assert.Equal(401, ex.Status);
    }

    [Fact]
    public async Task Code_expires_after_five_minutes()
    {
        await Send();
        var code = SentCode();
        _clock.Advance(TimeSpan.FromMinutes(5) + TimeSpan.FromSeconds(1));
        var ex = await Assert.ThrowsAsync<AuthException>(() => Verify(code));
        Assert.Equal("expired", ex.Code);
    }

    [Fact]
    public async Task Verify_without_a_prior_send_is_expired()
    {
        var ex = await Assert.ThrowsAsync<AuthException>(() => Verify("123456"));
        Assert.Equal("expired", ex.Code);
    }

    [Fact]
    public async Task Both_phone_and_email_is_rejected()
    {
        var ex = await Assert.ThrowsAsync<AuthException>(() =>
            _sut.SendCodeAsync(new SendCodeRequest { Phone = Phone, Email = "a@b.com" }, null, default));
        Assert.Equal(400, ex.Status);
    }
}
