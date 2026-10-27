using System.Text.Json.Serialization;
using CasaFit.Application.Auth;

namespace CasaFit.Application.Entitlements;

public sealed record ConsumeRequest
{
    public string IdempotencyKey { get; init; } = "";
    /// <summary>squat, push_up, plank or lunge. Validated, not stored.</summary>
    public string Exercise { get; init; } = "";
}

/// <summary>Shape matches shared/src/entitlements.ts: { ok: true, freeChecksRemaining } or { ok: false, reason }.</summary>
public sealed record ConsumeResponse
{
    public bool Ok { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? FreeChecksRemaining { get; init; }

    /// <summary>no_credits or pro_active.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Reason { get; init; }
}

public sealed record RefundRequest
{
    public string IdempotencyKey { get; init; } = "";
    /// <summary>The idempotency key of the consume being reversed.</summary>
    public string ConsumeIdempotencyKey { get; init; } = "";
    /// <summary>Reps completed when the user quit. A refund is legal only before rep 3 (decision D5).</summary>
    public int RepsCompleted { get; init; }
}

public sealed record RefundResponse(bool Ok, int FreeChecksRemaining);

public sealed record EntitlementsStatus(int FreeChecksRemaining, ProState Pro);

public sealed record ContentVersionResponse(int FoodPack, int Exercises);

/// <summary>The part of a RevenueCat webhook we read. Receipts and purchaser details are never read or stored.</summary>
public sealed record RevenueCatWebhookRequest
{
    [JsonPropertyName("event")]
    public RevenueCatEvent? Event { get; init; }
}

public sealed record RevenueCatEvent
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("type")] public string Type { get; init; } = "";
    [JsonPropertyName("app_user_id")] public string AppUserId { get; init; } = "";
    [JsonPropertyName("event_timestamp_ms")] public long? EventTimestampMs { get; init; }
    [JsonPropertyName("expiration_at_ms")] public long? ExpirationAtMs { get; init; }
}

/// <summary>Processed is true when Pro state changed; false for a replay, an old event, an ignored type, or an unknown user.</summary>
public sealed record WebhookAck(bool Processed, string Outcome);
