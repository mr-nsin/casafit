using System.Text.Json;
using System.Text.Json.Serialization;
using CasaFit.Application.Auth;

namespace CasaFit.Application.Accounts;

/// <summary>
/// Plan metadata per decision D3. Any field not listed here (health flags, pain areas, age, weight and so on)
/// lands in <see cref="Unknown"/> and the validator rejects the request with 400.
/// </summary>
public sealed record UpsertPlanRequest
{
    public string Goal { get; init; } = "";
    /// <summary>Bitmask: 1 normal, 2 yoga, 4 dance.</summary>
    public int Styles { get; init; }
    public int Days { get; init; }
    public string Experience { get; init; } = "";
    public string Variant { get; init; } = "";

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Unknown { get; init; }
}

public sealed record PlanResponse(
    string Goal, int Styles, int Days, string Experience, string Variant, int WeekNumber, DateTimeOffset UpdatedAt);

public sealed record MeResponse(
    Guid Id,
    string Locale,
    bool Onboarded,
    DateTimeOffset CreatedAt,
    int FreeChecksRemaining,
    ProState Pro,
    PlanResponse? Plan);

public sealed record RecordConsentRequest
{
    public string Type { get; init; } = "";
    public bool Granted { get; init; }
    public string PolicyVersion { get; init; } = "";
}

public sealed record ConsentResponse(Guid Id, string Type, bool Granted, string PolicyVersion, DateTimeOffset RecordedAt);

// Sync batches. Ids come from the phone so a retry never duplicates a row.
public sealed record StepEntry
{
    public DateOnly Date { get; init; }
    public int Steps { get; init; }
    public int BriskMinutes { get; init; }
}

public sealed record SyncStepsRequest
{
    public List<StepEntry> Entries { get; init; } = [];
}

public sealed record SessionEntry
{
    public Guid Id { get; init; }
    public int PlanWeek { get; init; }
    public int PlanDay { get; init; }
    public string Style { get; init; } = "";
    /// <summary>Clamped to 60..3600 when stored.</summary>
    public int DurationS { get; init; }
    public string Felt { get; init; } = "";
    public DateTimeOffset CompletedAt { get; init; }
}

public sealed record SyncSessionsRequest
{
    public List<SessionEntry> Entries { get; init; } = [];
}

public sealed record FoodEntryDto
{
    public Guid Id { get; init; }
    public DateOnly LoggedOn { get; init; }
    public string Meal { get; init; } = "";
    public string FoodId { get; init; } = "";
    public decimal Portions { get; init; }
}

public sealed record SyncFoodRequest
{
    public List<FoodEntryDto> Entries { get; init; } = [];
}

/// <summary>Received is the batch size, Stored the rows written or updated, Clamped the sessions whose duration was adjusted.</summary>
public sealed record SyncResponse(int Received, int Stored, int Clamped);

public sealed record ExportAccount(Guid Id, string? Phone, string? Email, string Locale, bool Onboarded, DateTimeOffset CreatedAt);

/// <summary>
/// Everything we hold about the account. Returned inline for now; a signed download URL needs object storage (see open questions).
/// </summary>
public sealed record ExportResponse(
    DateTimeOffset GeneratedAt,
    ExportAccount Account,
    PlanResponse? Plan,
    IReadOnlyList<ConsentResponse> Consents,
    IReadOnlyList<SessionEntry> Sessions,
    IReadOnlyList<FoodEntryDto> Food,
    IReadOnlyList<StepEntry> Steps);
