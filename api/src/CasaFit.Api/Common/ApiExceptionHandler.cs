using CasaFit.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CasaFit.Api.Common;

/// <summary>One error shape for the app: RFC 9457 ProblemDetails, with a machine-readable `code` where we have one.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var problem = exception is DomainException auth
            ? new ProblemDetails { Status = auth.Status, Title = auth.Message, Extensions = { ["code"] = auth.Code } }
            : new ProblemDetails { Status = StatusCodes.Status500InternalServerError, Title = "Something went wrong." };

        if (exception is not DomainException)
            log.LogError(exception, "Unhandled exception"); // never log request bodies: they can hold phones and codes

        context.Response.StatusCode = problem.Status!.Value;
        // Written directly so the media type is application/problem+json whatever the client's Accept header says.
        await context.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json", ct);
        return true;
    }
}
