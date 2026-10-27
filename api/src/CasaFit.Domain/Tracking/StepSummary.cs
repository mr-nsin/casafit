namespace CasaFit.Domain.Tracking;

/// <summary>One row per account and local date. GPS is never stored.</summary>
public sealed class StepSummary
{
    public Guid AccountId { get; set; }
    public DateOnly OnDate { get; set; }
    public int Steps { get; set; }
    public int BriskMinutes { get; set; }
}
