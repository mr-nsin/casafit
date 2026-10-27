namespace CasaFit.Domain.Entitlements;

/// <summary>
/// One consume or refund of a free form check. The unique index on (AccountId, Kind, IdempotencyKey)
/// is what makes a retried request safe.
/// </summary>
public sealed class FormCheckEvent
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public FormCheckKind Kind { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public DateTimeOffset At { get; set; }
}

public enum FormCheckKind
{
    Consume,
    Refund,
}
