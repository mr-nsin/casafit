using CasaFit.Api.Common;
using CasaFit.Application.Accounts;
using Microsoft.AspNetCore.Mvc;

namespace CasaFit.Api.Accounts;

[ApiController]
[Produces("application/json")]
[Route("v1/me")]
public sealed class MeController(AccountService accounts, SyncService sync) : ControllerBase
{
    /// <summary>Account summary: plan, free checks, Pro state.</summary>
    [HttpGet]
    [ProducesResponseType<MeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public Task<MeResponse> Get(CancellationToken ct) => accounts.GetMeAsync(User.AccountId(), ct);

    /// <summary>Create or replace plan metadata. Health fields are rejected with 400 (decision D3).</summary>
    [HttpPut("plan")]
    [ProducesResponseType<PlanResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<PlanResponse> PutPlan(UpsertPlanRequest request, CancellationToken ct) =>
        accounts.UpsertPlanAsync(User.AccountId(), request, ct);

    /// <summary>Record a consent decision (append-only).</summary>
    [HttpPost("consents")]
    [ProducesResponseType<ConsentResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<ConsentResponse> PostConsent(RecordConsentRequest request, CancellationToken ct) =>
        accounts.RecordConsentAsync(User.AccountId(), request, ct);

    /// <summary>Return everything held about the account.</summary>
    [HttpPost("export")]
    [ProducesResponseType<ExportResponse>(StatusCodes.Status200OK)]
    public Task<ExportResponse> Export(CancellationToken ct) => accounts.ExportAsync(User.AccountId(), ct);

    /// <summary>Delete the account. A hash of the identifier is kept for 180 days so deletion does not restore free checks.</summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(CancellationToken ct)
    {
        await accounts.DeleteAsync(User.AccountId(), ct);
        return NoContent();
    }

    /// <summary>Upload daily step summaries (last entry per date wins).</summary>
    [HttpPost("sync/steps")]
    [ProducesResponseType<SyncResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<SyncResponse> SyncSteps(SyncStepsRequest request, CancellationToken ct) =>
        sync.SyncStepsAsync(User.AccountId(), request, ct);

    /// <summary>Upload completed sessions. Duration is clamped to 60..3600 seconds. Already stored ids are skipped.</summary>
    [HttpPost("sync/sessions")]
    [ProducesResponseType<SyncResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<SyncResponse> SyncSessions(SyncSessionsRequest request, CancellationToken ct) =>
        sync.SyncSessionsAsync(User.AccountId(), request, ct);

    /// <summary>Upload food log entries (upsert by id).</summary>
    [HttpPost("sync/food")]
    [ProducesResponseType<SyncResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public Task<SyncResponse> SyncFood(SyncFoodRequest request, CancellationToken ct) =>
        sync.SyncFoodAsync(User.AccountId(), request, ct);
}
