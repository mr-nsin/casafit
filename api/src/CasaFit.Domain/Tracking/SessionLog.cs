namespace CasaFit.Domain.Tracking;

/// <summary>One completed session. The id comes from the phone, so a retried sync never duplicates it.</summary>
public sealed class SessionLog
{
    public const int MinDurationSeconds = 60;
    public const int MaxDurationSeconds = 3600;

    public Guid AccountId { get; set; }
    public Guid Id { get; set; }
    public int PlanWeek { get; set; }
    public int PlanDay { get; set; }
    public string Style { get; set; } = "";
    public int DurationS { get; set; }
    public string Felt { get; set; } = "";
    public DateTimeOffset CompletedAt { get; set; }
}
