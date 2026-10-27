namespace CasaFit.Domain.Accounts;

/// <summary>
/// Plan metadata only (decision D3): goal, styles, days, experience and the derived variant.
/// Health flags and pain areas are never stored here; they stay on the phone.
/// </summary>
public sealed class Plan
{
    public Guid AccountId { get; set; }
    public string Goal { get; set; } = "";
    /// <summary>Bitmask: 1 normal, 2 yoga, 4 dance.</summary>
    public int Styles { get; set; }
    public int DaysPerWeek { get; set; }
    public string Experience { get; set; } = "";
    public string Variant { get; set; } = "";
    public int WeekNumber { get; set; } = 1;
    public DateTimeOffset UpdatedAt { get; set; }
}
