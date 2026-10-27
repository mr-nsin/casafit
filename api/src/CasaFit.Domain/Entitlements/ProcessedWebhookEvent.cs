namespace CasaFit.Domain.Entitlements;

/// <summary>Remembers a RevenueCat event id so a redelivery changes nothing. Holds no payload and no receipt.</summary>
public sealed class ProcessedWebhookEvent
{
    public string EventId { get; set; } = "";
    public DateTimeOffset ReceivedAt { get; set; }
}
