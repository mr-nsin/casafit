using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using CasaFit.Domain.Tracking;

namespace CasaFit.Application.Accounts;

public interface IAccountStore
{
    Task<Account?> GetAsync(Guid accountId, CancellationToken ct);
    Task<Plan?> GetPlanAsync(Guid accountId, CancellationToken ct);

    /// <summary>Creates or replaces the plan, keeps the week number, and marks the account onboarded.</summary>
    Task<Plan> UpsertPlanAsync(Guid accountId, Plan plan, CancellationToken ct);

    Task AddConsentAsync(ConsentRecord consent, CancellationToken ct);
    Task<IReadOnlyList<ConsentRecord>> ListConsentsAsync(Guid accountId, CancellationToken ct);

    Task<IReadOnlyList<SessionLog>> ListSessionsAsync(Guid accountId, CancellationToken ct);
    Task<IReadOnlyList<FoodEntry>> ListFoodAsync(Guid accountId, CancellationToken ct);
    Task<IReadOnlyList<StepSummary>> ListStepsAsync(Guid accountId, CancellationToken ct);

    /// <summary>Returns how many rows were written or updated.</summary>
    Task<int> UpsertStepsAsync(Guid accountId, IReadOnlyCollection<StepSummary> rows, CancellationToken ct);

    /// <summary>Sessions already stored are left as they are (they never change after completion).</summary>
    Task<int> UpsertSessionsAsync(Guid accountId, IReadOnlyCollection<SessionLog> rows, CancellationToken ct);
    Task<int> UpsertFoodAsync(Guid accountId, IReadOnlyCollection<FoodEntry> rows, CancellationToken ct);

    /// <summary>
    /// In one transaction: store each identifier hash (replacing an older row for the same hash),
    /// then delete the account and every personal row that hangs off it.
    /// </summary>
    Task DeleteAsync(Guid accountId, IReadOnlyCollection<DeletedIdentifierHash> hashes, CancellationToken ct);
}
