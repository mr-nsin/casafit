using CasaFit.Application.Auth;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CasaFit.Api.Common;

/// <summary>One error shape for the app: RFC 9457 ProblemDetails, with a machine-readable `code` where we have one.</summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problems, ILogger<ApiExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var problem = exception is AuthException auth
            ? new ProblemDetails { Status = auth.Status, Title = auth.Message, Extensions = { ["code"] = auth.Code } }
            : new ProblemDetails { Status = StatusCodes.Status500InternalServerError, Title = "Something went wrong." };

        if (exception is not AuthException)
            log.LogError(exception, "Unhandled exception"); // never log request bodies: they can hold phones and codes

        context.Response.StatusCode = problem.Status!.Value;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = problem,
            Exception = exception,
        });
    }
}
