namespace CasaFit.Domain.Accounts;

/// <summary>
/// One person. Identity lives in Supabase Auth: <see cref="ExternalId"/> is the Supabase user id (the JWT sub claim).
/// See docs/data-model.md section 1.
/// </summary>
public sealed class Account
{
    public const int FreeChecksForLife = 2;

    public Guid Id { get; set; }

    /// <summary>Supabase user id (sub claim). Unique.</summary>
    public string ExternalId { get; set; } = "";

    /// <summary>Lower-cased email from the token. Unique when present.</summary>
    public string? Email { get; set; }

    /// <summary>email, google, apple or facebook (from app_metadata.provider).</summary>
    public string Provider { get; set; } = "email";

    public DateTimeOffset CreatedAt { get; set; }
    public string Locale { get; set; } = "en-IN";
    public bool Onboarded { get; set; }
    public int FreeChecksRemaining { get; set; } = FreeChecksForLife;
    public bool ProActive { get; set; }
    public DateTimeOffset? ProExpiresAt { get; set; }

    /// <summary>Timestamp of the last RevenueCat event applied, so an older event delivered late is ignored.</summary>
    public DateTimeOffset? ProEventAt { get; set; }
}
