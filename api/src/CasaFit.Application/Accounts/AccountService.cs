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
    IIdentityAdmin identity,
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
            account.Id, account.Email, EmailIdentity.Mask(account.Email), account.Provider,
            account.Locale, account.Onboarded, account.CreatedAt,
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
            new ExportAccount(account.Id, account.Email, account.Provider, account.Locale, account.Onboarded, account.CreatedAt),
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
    /// Deletes the local account and personal rows, keeps only an HMAC of the email and of the Supabase user id for
    /// 180 days (so signing up again does not restore free checks and a live token cannot re-create the account),
    /// then deletes the Supabase user. Local data goes first. If the Supabase call fails this throws a 502 problem
    /// and the client retries the same request: the retry skips the local part and repeats the Supabase call.
    /// </summary>
    public async Task DeleteAsync(string externalId, CancellationToken ct)
    {
        var account = await store.FindByExternalIdAsync(externalId, ct);
        if (account is not null)
        {
            var now = clock.GetUtcNow();
            var hashes = new List<DeletedIdentifierHash> { Tombstone(IdentifierHasher.ForExternalId(_pepper, externalId), now) };
            if (!string.IsNullOrEmpty(account.Email))
                hashes.Add(Tombstone(IdentifierHasher.ForEmail(_pepper, account.Email), now));

            await store.DeleteAsync(account.Id, hashes, ct);
            log.LogInformation("Deleted account {AccountId}", account.Id);
        }

        try
        {
            await identity.DeleteUserAsync(externalId, ct);
        }
        catch (IdentityAdminException ex)
        {
            log.LogError(ex, "Supabase user delete failed for account {AccountId}", account?.Id);
            throw new DomainException(AuthStatus.BadGateway, "identity_delete_failed",
                "Your CasaFit data is deleted, but your sign-in record could not be removed yet. Try again in a moment.");
        }
    }

    private static DeletedIdentifierHash Tombstone(byte[] hash, DateTimeOffset now) =>
        new() { Hash = hash, DeletedAt = now, ExpiresAt = now + DeletedHashRetention };

    private async Task<Account> RequireAsync(Guid accountId, CancellationToken ct) =>
        await store.GetAsync(accountId, ct)
        ?? throw new DomainException(AuthStatus.Unauthorized, "account_not_found", "This account no longer exists. Sign in again.");

    private static PlanResponse ToResponse(Plan p) =>
        new(p.Goal, p.Styles, p.DaysPerWeek, p.Experience, p.Variant, p.WeekNumber, p.UpdatedAt);

    private static ConsentResponse ToResponse(ConsentRecord c) =>
        new(c.Id, c.Type, c.Granted, c.PolicyVersion, c.RecordedAt);
}
