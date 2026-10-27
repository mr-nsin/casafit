using CasaFit.Api.Common;
using CasaFit.Application.Entitlements;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CasaFit.Api.Entitlements;

[ApiController]
[Produces("application/json")]
public sealed class EntitlementsController(EntitlementService entitlements, RevenueCatWebhookService webhook) : ControllerBase
{
    /// <summary>Free checks left and Pro state.</summary>
    [HttpGet("v1/me/entitlements")]
    [ProducesResponseType<EntitlementsStatus>(StatusCodes.Status200OK)]
    public Task<EntitlementsStatus> Get(CancellationToken ct) => entitlements.GetStatusAsync(User.AccountId(), ct);

    /// <summary>Spend one free check. Safe to retry with the same idempotency key.</summary>
    [HttpPost("v1/entitlements/form-check/consume")]
    [Consumes("application/json")]
    [ProducesResponseType<ConsumeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<ConsumeResponse> Consume(ConsumeRequest request, CancellationToken ct) =>
        entitlements.ConsumeAsync(User.AccountId(), request, ct);

    /// <summary>Give one free check back. Legal only before rep 3, once per consume.</summary>
    [HttpPost("v1/entitlements/form-check/refund")]
    [Consumes("application/json")]
    [ProducesResponseType<RefundResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public Task<RefundResponse> Refund(RefundRequest request, CancellationToken ct) =>
        entitlements.RefundAsync(User.AccountId(), request, ct);

    /// <summary>RevenueCat server-to-server event. Authenticated by the shared secret in the Authorization header.</summary>
    [AllowAnonymous]
    [HttpPost("v1/webhooks/revenuecat")]
    [Consumes("application/json")]
    [ProducesResponseType<WebhookAck>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RevenueCat(RevenueCatWebhookRequest request, CancellationToken ct)
    {
        if (!webhook.IsAuthentic(Request.Headers.Authorization.FirstOrDefault()))
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Webhook not authenticated.");
        return Ok(await webhook.HandleAsync(request.Event!, ct));
    }
}
