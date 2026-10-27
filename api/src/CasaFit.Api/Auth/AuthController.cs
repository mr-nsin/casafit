using CasaFit.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CasaFit.Api.Auth;

[ApiController]
[AllowAnonymous]
[EnableRateLimiting("auth")]
[Consumes("application/json")]
[Produces("application/json")]
[Route("v1/auth")]
public sealed class AuthController(AuthService auth) : ControllerBase
{
    public const string AttestationHeader = "X-Attestation";

    /// <summary>Send a 6-digit code to the given phone or email.</summary>
    [HttpPost("code")]
    [ProducesResponseType<SendCodeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    public async Task<SendCodeResponse> SendCode(SendCodeRequest request, CancellationToken ct) =>
        await auth.SendCodeAsync(request, Request.Headers[AttestationHeader].FirstOrDefault(), ct);

    /// <summary>Verify a 6-digit code and return session tokens.</summary>
    [HttpPost("verify")]
    [ProducesResponseType<VerifyCodeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<VerifyCodeResponse> Verify(VerifyCodeRequest request, CancellationToken ct) =>
        await auth.VerifyAsync(request, ct);

    /// <summary>Trade a refresh token for a new access and refresh token.</summary>
    [HttpPost("refresh")]
    [ProducesResponseType<TokenPair>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<TokenPair> Refresh(RefreshRequest request, [FromServices] RefreshService refresh, CancellationToken ct) =>
        await refresh.RefreshAsync(request, ct);
}
