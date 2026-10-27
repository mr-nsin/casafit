namespace CasaFit.Domain.Accounts;

/// <summary>One person. Holds either a phone, an email, or both. See docs/data-model.md section 1.</summary>
public sealed class Account
{
    public const int FreeChecksForLife = 2;

    public Guid Id { get; set; }
    public string? PhoneE164 { get; set; }
    public string? EmailNorm { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string Locale { get; set; } = "en-IN";
    public bool Onboarded { get; set; }
    public int FreeChecksRemaining { get; set; } = FreeChecksForLife;
    public bool ProActive { get; set; }
    public DateTimeOffset? ProExpiresAt { get; set; }

    /// <summary>Timestamp of the last RevenueCat event applied, so an older event delivered late is ignored.</summary>
    public DateTimeOffset? ProEventAt { get; set; }
}
