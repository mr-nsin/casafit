using CasaFit.Domain.Accounts;

namespace CasaFit.Domain.Auth;

/// <summary>One OTP send or verify attempt. The identifier is stored only as an HMAC hash.</summary>
public sealed class OtpAttempt
{
    public Guid Id { get; set; }
    public Guid? AccountId { get; set; }
    public byte[] IdentifierHash { get; set; } = [];
    public IdentifierKind Channel { get; set; }
    public OtpAttemptKind Kind { get; set; }
    public bool Success { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public enum OtpAttemptKind
{
    Send,
    Verify,
}
