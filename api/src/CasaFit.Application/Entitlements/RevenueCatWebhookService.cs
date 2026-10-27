using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CasaFit.Application.Entitlements;

public sealed class RevenueCatOptions
{
    public const string Section = "RevenueCat";

    /// <summary>
    /// The value configured as the webhook Authorization header in the RevenueCat dashboard. When empty, every webhook is rejected.
    /// </summary>
    public string WebhookSecret { get; set; } = "";
}

/// <summary>
/// Turns RevenueCat events into Pro state. Idempotent on the event id, ignores events older than the last one applied,
/// and never logs or stores the payload (it can carry receipts and purchaser details).
/// </summary>
public sealed class RevenueCatWebhookService(
    IEntitlementStore store,
    IOptions<RevenueCatOptions> options,
    ILogger<RevenueCatWebhookService> log)
{
    private static readonly HashSet<string> Activating =
        ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "NON_RENEWING_PURCHASE"];

    /// <summary>Accepts "Bearer secret" or the bare secret. Fixed-time comparison. Fails closed when no secret is set.</summary>
    public bool IsAuthentic(string? authorizationHeader)
    {
        var secret = options.Value.WebhookSecret;
        if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(authorizationHeader)) return false;

        var presented = authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authorizationHeader[7..]
            : authorizationHeader;
        var a = SHA256.HashData(Encoding.UTF8.GetBytes(presented));
        var b = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    public async Task<WebhookAck> HandleAsync(RevenueCatEvent ev, CancellationToken ct)
    {
        var activate = Activating.Contains(ev.Type);
        var expire = ev.Type == "EXPIRATION";
        if (!Guid.TryParse(ev.AppUserId, out var accountId) || (!activate && !expire))
            return new WebhookAck(false, "ignored");

        var eventAt = ev.EventTimestampMs is { } t ? DateTimeOffset.FromUnixTimeMilliseconds(t) : DateTimeOffset.UnixEpoch;
        DateTimeOffset? expiresAt = ev.ExpirationAtMs is { } x ? DateTimeOffset.FromUnixTimeMilliseconds(x) : null;

        var outcome = await store.RunAtomicAsync(async token =>
        {
            if (!await store.TryRegisterWebhookEventAsync(ev.Id, token))
                return new AtomicResult<string>("duplicate", false);

            var snapshot = await store.GetAsync(accountId, token);
            if (snapshot is null)
                return new AtomicResult<string>("unknown_account", true);
            if (snapshot.ProEventAt is { } last && last > eventAt)
                return new AtomicResult<string>("stale", true);

            await store.SetProAsync(accountId, activate, expiresAt, eventAt, token);
            return new AtomicResult<string>("applied", true);
        }, ct);

        log.LogInformation("RevenueCat {Type} for account {AccountId}: {Outcome}", ev.Type, accountId, outcome);
        return new WebhookAck(outcome == "applied", outcome);
    }
}
