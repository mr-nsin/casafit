using System.Security.Cryptography;
using System.Text;
using CasaFit.Application.Common;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CasaFit.Application.Auth;

public sealed class AuthOptions
{
    public const string Section = "Auth";

    /// <summary>Server-side secret for hashing identifiers and codes. Set Auth__Pepper in every environment.</summary>
    public string Pepper { get; set; } = "";
}

/// <summary>A failure the API should report with a specific status and machine-readable code.</summary>
public sealed class AuthException(int status, string code, string detail) : DomainException(status, code, detail);

public sealed class AuthService(
    IOtpStore otpStore,
    IOtpSender sender,
    IAttestationVerifier attestation,
    IAuthStore store,
    ITokenService tokens,
    IOptions<AuthOptions> options,
    TimeProvider clock,
    ILogger<AuthService> log)
{
    public const int CodeLength = 6;
    public const int MaxSendsPerHour = 5;
    public const int MaxVerifyTries = 3;
    public static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan ResendWindow = TimeSpan.FromSeconds(30);

    private readonly byte[] _pepper = Encoding.UTF8.GetBytes(options.Value.Pepper);

    public async Task<SendCodeResponse> SendCodeAsync(SendCodeRequest request, string? attestationToken, CancellationToken ct)
    {
        var (kind, value) = Resolve(request.Phone, request.Email);

        if (!await attestation.VerifyAsync(attestationToken, ct))
            throw new AuthException(AuthStatus.Forbidden, "attestation_failed", "Device check failed.");

        var idHash = HashIdentifier(value);
        var key = Convert.ToHexString(idHash);

        var window = await otpStore.GetSendWindowAsync(key, ct);
        if (window.Count >= MaxSendsPerHour)
            return new SendCodeResponse(window.SecondsLeft, 0);

        var wait = await otpStore.TryAcquireResendLockAsync(key, ResendWindow, ct);
        if (wait > 0)
            return new SendCodeResponse(wait, MaxSendsPerHour - window.Count);

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        await otpStore.SaveCodeAsync(key, HashCode(key, code), CodeLifetime, ct);
        var count = await otpStore.IncrementSendCountAsync(key, ct);

        await sender.SendAsync(kind, value, code, ct);
        await store.RecordOtpAttemptAsync(NewAttempt(idHash, kind, OtpAttemptKind.Send, true, null), ct);

        return new SendCodeResponse((int)ResendWindow.TotalSeconds, Math.Max(0, MaxSendsPerHour - count));
    }

    public async Task<VerifyCodeResponse> VerifyAsync(VerifyCodeRequest request, CancellationToken ct)
    {
        var (kind, value) = Resolve(request.Phone, request.Email);
        var idHash = HashIdentifier(value);
        var key = Convert.ToHexString(idHash);

        var failure = await CheckCodeAsync(key, request.Code, ct);
        if (failure is not null)
        {
            await store.RecordOtpAttemptAsync(NewAttempt(idHash, kind, OtpAttemptKind.Verify, false, null), ct);
            throw new AuthException(AuthStatus.Unauthorized, failure, "The code did not verify.");
        }

        var existing = await store.FindAccountAsync(kind, value, ct);
        var account = existing;
        var isNew = false;
        if (account is null)
        {
            // A recently deleted identifier does not get a fresh batch of free checks.
            var deleted = await store.IsDeletedIdentifierAsync(idHash, ct);
            var (created, wasCreated) = await store.GetOrCreateAccountAsync(
                kind, value, deleted ? 0 : Account.FreeChecksForLife, ct);
            account = created;
            isNew = wasCreated;
        }

        await store.RecordOtpAttemptAsync(NewAttempt(idHash, kind, OtpAttemptKind.Verify, true, account.Id), ct);
        log.LogInformation("Verified sign-in for account {AccountId} (new: {IsNew})", account.Id, isNew);

        var pair = tokens.Issue(account.Id);
        return new VerifyCodeResponse(
            pair.AccessToken, pair.RefreshToken, isNew, account.FreeChecksRemaining,
            new ProState(account.ProActive, account.ProExpiresAt));
    }

    /// <summary>Returns null when the code is right, otherwise the failure code.</summary>
    private async Task<string?> CheckCodeAsync(string key, string code, CancellationToken ct)
    {
        var record = await otpStore.GetCodeAsync(key, ct);
        if (record is null) return "expired";
        if (record.Tries >= MaxVerifyTries)
        {
            await otpStore.DeleteCodeAsync(key, ct);
            return "no_tries_left";
        }

        await otpStore.IncrementTriesAsync(key, ct);
        if (!CryptographicOperations.FixedTimeEquals(record.CodeHash, HashCode(key, code))) return "wrong";

        await otpStore.DeleteCodeAsync(key, ct);
        return null;
    }

    private (IdentifierKind Kind, string Value) Resolve(string? phone, string? email)
    {
        var hasPhone = !string.IsNullOrWhiteSpace(phone);
        var hasEmail = !string.IsNullOrWhiteSpace(email);
        if (hasPhone == hasEmail)
            throw new AuthException(AuthStatus.BadRequest, "invalid_identifier", "Provide exactly one of phone or email.");

        var kind = hasPhone ? IdentifierKind.Phone : IdentifierKind.Email;
        if (!IdentifierNormaliser.TryNormalise(kind, hasPhone ? phone : email, out var value))
            throw new AuthException(AuthStatus.BadRequest, "invalid_identifier", "The phone number or email is not valid.");
        return (kind, value);
    }

    private byte[] HashIdentifier(string normalised) => IdentifierHasher.Hash(_pepper, normalised);

    private byte[] HashCode(string key, string code) =>
        HMACSHA256.HashData(_pepper, Encoding.UTF8.GetBytes($"{key}:{code}"));

    private OtpAttempt NewAttempt(byte[] idHash, IdentifierKind kind, OtpAttemptKind attemptKind, bool success, Guid? accountId) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        IdentifierHash = idHash,
        Channel = kind,
        Kind = attemptKind,
        Success = success,
        CreatedAt = clock.GetUtcNow(),
    };
}

/// <summary>HTTP status numbers, so the Application layer does not depend on ASP.NET.</summary>
public static class AuthStatus
{
    public const int BadRequest = 400;
    public const int Unauthorized = 401;
    public const int Forbidden = 403;
}

/// <summary>The one place identifiers are hashed, so sign-in and account deletion always agree.</summary>
public static class IdentifierHasher
{
    public static byte[] Hash(byte[] pepper, string normalised) =>
        HMACSHA256.HashData(pepper, Encoding.UTF8.GetBytes(normalised));
}
