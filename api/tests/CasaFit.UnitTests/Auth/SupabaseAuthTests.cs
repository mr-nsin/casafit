using System.Text.Json;
using CasaFit.Application.Auth;
using CasaFit.Application.Entitlements;
using CasaFit.Domain.Accounts;
using CasaFit.Infrastructure.Auth;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace CasaFit.UnitTests.Auth;

public class EmailIdentityTests
{
    /// <summary>Non-null email vectors from the shared fixture. Rejection (disposable domains) is Supabase's job now.</summary>
    public static IEnumerable<object[]> Vectors()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "identifiers.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        foreach (var v in doc.RootElement.GetProperty("email").EnumerateArray())
        {
            var expected = v.GetProperty("expected");
            if (expected.ValueKind == JsonValueKind.String)
                yield return [v.GetProperty("input").GetString()!, expected.GetString()!];
        }
    }

    [Theory]
    [MemberData(nameof(Vectors))]
    public void Canonical_passes_the_shared_email_vectors(string input, string expected) =>
        Assert.Equal(expected, EmailIdentity.Canonical(input));

    [Theory]
    [InlineData("nitin@gmail.com", "n***@gmail.com")]
    [InlineData("A@x.io", "A***@x.io")]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Mask_keeps_the_first_letter_and_the_domain(string? email, string? expected) =>
        Assert.Equal(expected, EmailIdentity.Mask(email));

    [Theory]
    [InlineData("google", "google")]
    [InlineData("Apple", "apple")]
    [InlineData("facebook", "facebook")]
    [InlineData("email", "email")]
    [InlineData("phone", "email")]
    [InlineData(null, "email")]
    public void Provider_is_one_of_the_four_known_values(string? input, string expected) =>
        Assert.Equal(expected, ExternalIdentity.NormaliseProvider(input));
}

public class AccountProvisionerTests
{
    private const string Pepper = "unit-test-pepper-0123456789";
    private readonly IAuthStore _store = Substitute.For<IAuthStore>();
    private readonly AccountProvisioner _sut;

    public AccountProvisionerTests() =>
        _sut = new AccountProvisioner(_store, Options.Create(new AuthOptions { Pepper = Pepper }), NullLogger<AccountProvisioner>.Instance);

    private static readonly ExternalIdentity Who = new("sub-1", "asha@example.com", "google");

    [Fact]
    public async Task First_request_creates_the_account_with_two_free_checks()
    {
        var created = new Account { Id = Guid.NewGuid(), ExternalId = "sub-1" };
        _store.GetOrCreateByExternalIdAsync(Who, Account.FreeChecksForLife, Arg.Any<CancellationToken>()).Returns(created);

        var result = await _sut.EnsureAsync(Who, default);

        Assert.Equal(created.Id, result.AccountId);
        Assert.False(result.Deleted);
    }

    [Fact]
    public async Task An_unchanged_known_account_is_not_written()
    {
        var known = new Account { Id = Guid.NewGuid(), ExternalId = "sub-1", Email = "asha@example.com", Provider = "google" };
        _store.FindByExternalIdAsync("sub-1", Arg.Any<CancellationToken>()).Returns(known);

        var result = await _sut.EnsureAsync(Who, default);

        Assert.Equal(known.Id, result.AccountId);
        await _store.DidNotReceiveWithAnyArgs().GetOrCreateByExternalIdAsync(default!, default, default);
    }

    [Fact]
    public async Task A_changed_email_is_passed_to_the_store_to_refresh()
    {
        var known = new Account { Id = Guid.NewGuid(), ExternalId = "sub-1", Email = "old@example.com", Provider = "google" };
        _store.FindByExternalIdAsync("sub-1", Arg.Any<CancellationToken>()).Returns(known);
        _store.GetOrCreateByExternalIdAsync(Who, Arg.Any<int>(), Arg.Any<CancellationToken>()).Returns(known);

        await _sut.EnsureAsync(Who, default);

        await _store.Received(1).GetOrCreateByExternalIdAsync(Who, Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_deleted_user_id_is_not_provisioned_again()
    {
        _store.IsDeletedIdentifierAsync(Arg.Is<byte[]>(h => h.SequenceEqual(IdentifierHasher.ForExternalId(System.Text.Encoding.UTF8.GetBytes(Pepper), "sub-1"))),
            Arg.Any<CancellationToken>()).Returns(true);

        var result = await _sut.EnsureAsync(Who, default);

        Assert.True(result.Deleted);
        Assert.Null(result.AccountId);
        await _store.DidNotReceiveWithAnyArgs().GetOrCreateByExternalIdAsync(default!, default, default);
    }

    [Fact]
    public async Task A_recently_deleted_email_signing_up_again_gets_no_free_checks()
    {
        var emailHash = IdentifierHasher.ForEmail(System.Text.Encoding.UTF8.GetBytes(Pepper), "asha@example.com");
        _store.IsDeletedIdentifierAsync(Arg.Is<byte[]>(h => h.SequenceEqual(emailHash)), Arg.Any<CancellationToken>()).Returns(true);
        _store.GetOrCreateByExternalIdAsync(Who, 0, Arg.Any<CancellationToken>()).Returns(new Account { Id = Guid.NewGuid(), FreeChecksRemaining = 0 });

        await _sut.EnsureAsync(Who, default);

        await _store.Received(1).GetOrCreateByExternalIdAsync(Who, 0, Arg.Any<CancellationToken>());
    }
}

public class WebhookSecretTests
{
    private static RevenueCatWebhookService Service(string secret) => new(
        Substitute.For<IEntitlementStore>(),
        Options.Create(new RevenueCatOptions { WebhookSecret = secret }),
        NullLogger<RevenueCatWebhookService>.Instance);

    [Theory]
    [InlineData("s3cret", "s3cret", true)]
    [InlineData("s3cret", "S3cret", false)]
    [InlineData("s3cret", "Bearer s3cret", false)]
    [InlineData("s3cret", "", false)]
    [InlineData("s3cret", null, false)]
    [InlineData("", "", false)]
    [InlineData("", null, false)]
    public void Header_must_equal_the_secret_exactly(string secret, string? header, bool expected) =>
        Assert.Equal(expected, Service(secret).IsAuthentic(header));
}

public class SupabaseSigningKeysTests
{
    private const string Secret = "unit-test-supabase-secret-0123456789abcdef";

    private static SupabaseSigningKeys Keys(string secret) => new(
        // Port 1 refuses connections at once, so the JWKS path is exercised without a network.
        Options.Create(new SupabaseOptions { Url = "http://127.0.0.1:1", JwtSecret = secret }),
        TimeProvider.System, NullLogger<SupabaseSigningKeys>.Instance);

    private static JsonWebToken Token(SecurityKey key, string alg)
    {
        var jwt = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object> { ["sub"] = "x" },
            SigningCredentials = new SigningCredentials(key, alg),
        });
        return new JsonWebToken(jwt);
    }

    [Fact]
    public void An_HS256_token_is_checked_with_the_shared_secret_only()
    {
        var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(Secret));
        var token = Token(key, SecurityAlgorithms.HmacSha256);

        var keys = Keys(Secret).Resolve(token.EncodedToken, token, null, new TokenValidationParameters()).ToList();

        Assert.Single(keys);
    }

    [Fact]
    public void An_HS256_token_gets_no_key_when_no_secret_is_configured()
    {
        var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(Secret));
        var token = Token(key, SecurityAlgorithms.HmacSha256);

        Assert.Empty(Keys("").Resolve(token.EncodedToken, token, null, new TokenValidationParameters()));
    }

    [Fact]
    public void An_asymmetric_token_never_gets_the_shared_secret_and_an_unreachable_JWKS_gives_no_keys()
    {
        using var ec = System.Security.Cryptography.ECDsa.Create(System.Security.Cryptography.ECCurve.NamedCurves.nistP256);
        var token = Token(new ECDsaSecurityKey(ec), SecurityAlgorithms.EcdsaSha256);

        var keys = Keys(Secret).Resolve(token.EncodedToken, token, "kid-1", new TokenValidationParameters()).ToList();

        Assert.Empty(keys);
    }

    [Fact]
    public void An_unsigned_or_unlisted_algorithm_gets_no_key()
    {
        var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(Secret + Secret));
        var token = Token(key, SecurityAlgorithms.HmacSha512);

        Assert.Empty(Keys(Secret).Resolve(token.EncodedToken, token, null, new TokenValidationParameters()));
    }
}
