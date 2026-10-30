using CasaFit.Application.Entitlements;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CasaFit.Api.Entitlements;

/// <summary>
/// Checks the webhook secret before model binding and validation run, so a caller without the secret
/// always gets 401, never a 400 that reveals what the body should look like.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RevenueCatSecretAttribute : Attribute, IAsyncResourceFilter
{
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var webhook = context.HttpContext.RequestServices.GetRequiredService<RevenueCatWebhookService>();
        if (webhook.IsAuthentic(context.HttpContext.Request.Headers.Authorization.FirstOrDefault()))
        {
            await next();
            return;
        }

        context.Result = new ObjectResult(new ProblemDetails
        {
            Status = StatusCodes.Status401Unauthorized,
            Title = "Webhook not authenticated.",
        })
        {
            StatusCode = StatusCodes.Status401Unauthorized,
            ContentTypes = { "application/problem+json" },
        };
    }
}
