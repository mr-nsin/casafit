using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;

namespace CasaFit.Application.Auth;

public sealed record OtpRecord(byte[] CodeHash, int Tries);

public sealed record SendWindow(int Count, int SecondsLeft);

/// <summary>Short-lived OTP state: codes, try counters, resend lock and hourly send counter. Redis in production.</summary>
public interface IOtpStore
{
    Task<SendWindow> GetSendWindowAsync(string key, CancellationToken ct);
    Task<int> IncrementSendCountAsync(string key, CancellationToken ct);

    /// <summary>Returns 0 when the lock was taken, otherwise the seconds until the next send is allowed.</summary>
    Task<int> TryAcquireResendLockAsync(string key, TimeSpan duration, CancellationToken ct);

    Task SaveCodeAsync(string key, byte[] codeHash, TimeSpan ttl, CancellationToken ct);
    Task<OtpRecord?> GetCodeAsync(string key, CancellationToken ct);
    Task<int> IncrementTriesAsync(string key, CancellationToken ct);
    Task DeleteCodeAsync(string key, CancellationToken ct);
}

/// <summary>Delivers the code. Real vendors (MSG91, Gupshup, Resend) plug in here; dev uses a fake.</summary>
public interface IOtpSender
{
    Task SendAsync(IdentifierKind kind, string destination, string code, CancellationToken ct);
}

/// <summary>Play Integrity / App Attest check run before any OTP send.</summary>
public interface IAttestationVerifier
{
    Task<bool> VerifyAsync(string? token, CancellationToken ct);
}

public interface IAuthStore
{
    Task<Account?> FindAccountAsync(IdentifierKind kind, string normalised, CancellationToken ct);

    /// <summary>Creates the account, or returns the existing one if a concurrent request won the race.</summary>
    Task<(Account Account, bool Created)> GetOrCreateAccountAsync(
        IdentifierKind kind, string normalised, int freeChecks, CancellationToken ct);

    Task<bool> IsDeletedIdentifierAsync(byte[] hash, CancellationToken ct);
    Task RecordOtpAttemptAsync(OtpAttempt attempt, CancellationToken ct);
}

public interface ITokenService
{
    TokenPair Issue(Guid accountId);

    /// <summary>Returns the account id inside a valid, unexpired refresh token, otherwise null.</summary>
    Task<Guid?> ValidateRefreshAsync(string refreshToken);
}
