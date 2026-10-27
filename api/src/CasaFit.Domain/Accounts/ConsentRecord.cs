namespace CasaFit.Domain.Accounts;

/// <summary>Append-only record of one consent decision (decision D20). Removed with the account.</summary>
public sealed class ConsentRecord
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    /// <summary>For example health_sync, analytics, privacy_notice, terms.</summary>
    public string Type { get; set; } = "";
    public bool Granted { get; set; }
    public string PolicyVersion { get; set; } = "";
    public DateTimeOffset RecordedAt { get; set; }
}
