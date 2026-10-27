using CasaFit.Application.Auth;
using CasaFit.Application.Common;
using CasaFit.Domain.Tracking;
using Microsoft.Extensions.Logging;

namespace CasaFit.Application.Accounts;

public sealed class SyncService(IAccountStore store, ILogger<SyncService> log)
{
    public async Task<SyncResponse> SyncStepsAsync(Guid accountId, SyncStepsRequest request, CancellationToken ct)
    {
        await EnsureExistsAsync(accountId, ct);
        // The last entry for a date wins.
        var rows = request.Entries
            .GroupBy(e => e.Date)
            .Select(g => g.Last())
            .Select(e => new StepSummary { AccountId = accountId, OnDate = e.Date, Steps = e.Steps, BriskMinutes = e.BriskMinutes })
            .ToList();
        var stored = await store.UpsertStepsAsync(accountId, rows, ct);
        log.LogInformation("Synced {Count} step rows for account {AccountId}", stored, accountId);
        return new SyncResponse(request.Entries.Count, stored, 0);
    }

    public async Task<SyncResponse> SyncSessionsAsync(Guid accountId, SyncSessionsRequest request, CancellationToken ct)
    {
        await EnsureExistsAsync(accountId, ct);
        var clamped = 0;
        var rows = new List<SessionLog>();
        foreach (var e in request.Entries.GroupBy(e => e.Id).Select(g => g.First()))
        {
            var duration = ClampDuration(e.DurationS);
            if (duration != e.DurationS) clamped++;
            rows.Add(new SessionLog
            {
                AccountId = accountId, Id = e.Id, PlanWeek = e.PlanWeek, PlanDay = e.PlanDay,
                Style = e.Style, DurationS = duration, Felt = e.Felt, CompletedAt = e.CompletedAt,
            });
        }
        var stored = await store.UpsertSessionsAsync(accountId, rows, ct);
        log.LogInformation("Synced {Count} sessions ({Clamped} clamped) for account {AccountId}", stored, clamped, accountId);
        return new SyncResponse(request.Entries.Count, stored, clamped);
    }

    public async Task<SyncResponse> SyncFoodAsync(Guid accountId, SyncFoodRequest request, CancellationToken ct)
    {
        await EnsureExistsAsync(accountId, ct);
        var rows = request.Entries
            .GroupBy(e => e.Id)
            .Select(g => g.Last())
            .Select(e => new FoodEntry
            {
                AccountId = accountId, Id = e.Id, LoggedOn = e.LoggedOn, Meal = e.Meal, FoodId = e.FoodId, Portions = e.Portions,
            })
            .ToList();
        var stored = await store.UpsertFoodAsync(accountId, rows, ct);
        log.LogInformation("Synced {Count} food rows for account {AccountId}", stored, accountId);
        return new SyncResponse(request.Entries.Count, stored, 0);
    }

    public static int ClampDuration(int seconds) =>
        Math.Clamp(seconds, SessionLog.MinDurationSeconds, SessionLog.MaxDurationSeconds);

    // A still-valid token of a deleted account must not write rows.
    private async Task EnsureExistsAsync(Guid accountId, CancellationToken ct)
    {
        if (await store.GetAsync(accountId, ct) is null)
            throw new DomainException(AuthStatus.Unauthorized, "account_not_found", "This account no longer exists. Sign in again.");
    }
}
