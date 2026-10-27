namespace CasaFit.Domain.Tracking;

public sealed class FoodEntry
{
    public Guid AccountId { get; set; }
    public Guid Id { get; set; }
    public DateOnly LoggedOn { get; set; }
    public string Meal { get; set; } = "";
    public string FoodId { get; set; } = "";
    public decimal Portions { get; set; }
}
