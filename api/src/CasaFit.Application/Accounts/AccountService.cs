using System.Text;
using CasaFit.Application.Auth;
using CasaFit.Application.Common;
using CasaFit.Application.Entitlements;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CasaFit.Application.Accounts;

public sealed class AccountService(
    IAccountStore store,
    IOptions<AuthOptions> auth,
    TimeProvider clock,
    ILogger<AccountService> log)
{
    /// <summary>How long a deleted identifier stays blocked from collecting new free checks (docs/data-model.md section 1).</summary>
    public static readonly TimeSpan DeletedHashRetention = TimeSpan.FromDays(180);

    private readonly byte[] _pepper = Encoding.UTF8.GetBytes(auth.Value.Pepper);

    public async Task<MeResponse> GetMeAsync(Guid accountId, CancellationToken ct)
    {
        var account = await RequireAsync(accountId, ct);
        var plan = await store.GetPlanAsync(accountId, ct);
        return new MeResponse(
            account.Id, account.Locale, account.Onboarded, account.CreatedAt,
            account.FreeChecksRemaining,
            EntitlementRules.ProOf(account.ProActive, account.ProExpiresAt, clock.GetUtcNow()),
            plan is null ? null : ToResponse(plan));
    }

    public async Task<PlanResponse> UpsertPlanAsync(Guid accountId, UpsertPlanRequest request, CancellationToken ct)
    {
        await RequireAsync(accountId, ct);
        var saved = await store.UpsertPlanAsync(accountId, new Plan
        {
            AccountId = accountId,
            Goal = request.Goal,
            Styles = request.Styles,
            DaysPerWeek = request.Days,
            Experience = request.Experience,
            Variant = request.Variant,
            UpdatedAt = clock.GetUtcNow(),
        }, ct);
        return ToResponse(saved);
    }

    public async Task<ConsentResponse> RecordConsentAsync(Guid accountId, RecordConsentRequest request, CancellationToken ct)
    {
        await RequireAsync(accountId, ct);
        var record = new ConsentRecord
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Type = request.Type,
            Granted = request.Granted,
            PolicyVersion = request.PolicyVersion,
            RecordedAt = clock.GetUtcNow(),
        };
        await store.AddConsentAsync(record, ct);
        return ToResponse(record);
    }

    public async Task<ExportResponse> ExportAsync(Guid accountId, CancellationToken ct)
    {
        var account = await RequireAsync(accountId, ct);
        var plan = await store.GetPlanAsync(accountId, ct);
        var consents = await store.ListConsentsAsync(accountId, ct);
        var sessions = await store.ListSessionsAsync(accountId, ct);
        var food = await store.ListFoodAsync(accountId, ct);
        var steps = await store.ListStepsAsync(accountId, ct);

        log.LogInformation("Exported data for account {AccountId}", accountId);
        return new ExportResponse(
            clock.GetUtcNow(),
            new ExportAccount(account.Id, account.PhoneE164, account.EmailNorm, account.Locale, account.Onboarded, account.CreatedAt),
            plan is null ? null : ToResponse(plan),
            consents.Select(ToResponse).ToList(),
            sessions.Select(s => new SessionEntry
            {
                Id = s.Id, PlanWeek = s.PlanWeek, PlanDay = s.PlanDay, Style = s.Style,
                DurationS = s.DurationS, Felt = s.Felt, CompletedAt = s.CompletedAt,
            }).ToList(),
            food.Select(f => new FoodEntryDto { Id = f.Id, LoggedOn = f.LoggedOn, Meal = f.Meal, FoodId = f.FoodId, Portions = f.Portions }).ToList(),
            steps.Select(s => new StepEntry { Date = s.OnDate, Steps = s.Steps, BriskMinutes = s.BriskMinutes }).ToList());
    }

    /// <summary>
    /// Deletes the account and personal rows, and keeps only an HMAC of each identifier for 180 days so that
    /// signing up again with the same phone or email does not restore the free checks. Deleting twice is a no-op.
    /// </summary>
    public async Task DeleteAsync(Guid accountId, CancellationToken ct)
    {
        var account = await store.GetAsync(accountId, ct);
        if (account is null) return;

        var now = clock.GetUtcNow();
        var hashes = new List<DeletedIdentifierHash>();
        foreach (var identifier in new[] { account.PhoneE164, account.EmailNorm })
        {
            if (string.IsNullOrEmpty(identifier)) continue;
            hashes.Add(new DeletedIdentifierHash
            {
                Hash = IdentifierHasher.Hash(_pepper, identifier),
                DeletedAt = now,
                ExpiresAt = now + DeletedHashRetention,
            });
        }

        await store.DeleteAsync(accountId, hashes, ct);
        log.LogInformation("Deleted account {AccountId}", accountId);
    }

    private async Task<Account> RequireAsync(Guid accountId, CancellationToken ct) =>
        await store.GetAsync(accountId, ct)
        ?? throw new DomainException(AuthStatus.Unauthorized, "account_not_found", "This account no longer exists. Sign in again.");

    private static PlanResponse ToResponse(Plan p) =>
        new(p.Goal, p.Styles, p.DaysPerWeek, p.Experience, p.Variant, p.WeekNumber, p.UpdatedAt);

    private static ConsentResponse ToResponse(ConsentRecord c) =>
        new(c.Id, c.Type, c.Granted, c.PolicyVersion, c.RecordedAt);
}
