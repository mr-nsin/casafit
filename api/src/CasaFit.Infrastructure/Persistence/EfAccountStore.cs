using CasaFit.Application.Accounts;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Auth;
using CasaFit.Domain.Tracking;
using Microsoft.EntityFrameworkCore;

namespace CasaFit.Infrastructure.Persistence;

public sealed class EfAccountStore(CasaFitDbContext db) : IAccountStore
{
    public Task<Account?> GetAsync(Guid accountId, CancellationToken ct) =>
        db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == accountId, ct);

    public Task<Plan?> GetPlanAsync(Guid accountId, CancellationToken ct) =>
        db.Plans.AsNoTracking().FirstOrDefaultAsync(p => p.AccountId == accountId, ct);

    public async Task<Plan> UpsertPlanAsync(Guid accountId, Plan plan, CancellationToken ct)
    {
        var existing = await db.Plans.FirstOrDefaultAsync(p => p.AccountId == accountId, ct);
        if (existing is null)
        {
            existing = plan;
            existing.WeekNumber = 1;
            db.Plans.Add(existing);
        }
        else
        {
            existing.Goal = plan.Goal;
            existing.Styles = plan.Styles;
            existing.DaysPerWeek = plan.DaysPerWeek;
            existing.Experience = plan.Experience;
            existing.Variant = plan.Variant;
            existing.UpdatedAt = plan.UpdatedAt;
        }
        await db.Accounts.Where(a => a.Id == accountId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.Onboarded, true), ct);
        await db.SaveChangesAsync(ct);
        return existing;
    }

    public async Task AddConsentAsync(ConsentRecord consent, CancellationToken ct)
    {
        db.ConsentRecords.Add(consent);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ConsentRecord>> ListConsentsAsync(Guid accountId, CancellationToken ct) =>
        await db.ConsentRecords.AsNoTracking().Where(c => c.AccountId == accountId).OrderBy(c => c.RecordedAt).ToListAsync(ct);

    public async Task<IReadOnlyList<SessionLog>> ListSessionsAsync(Guid accountId, CancellationToken ct) =>
        await db.SessionLogs.AsNoTracking().Where(s => s.AccountId == accountId).OrderBy(s => s.CompletedAt).ToListAsync(ct);

    public async Task<IReadOnlyList<FoodEntry>> ListFoodAsync(Guid accountId, CancellationToken ct) =>
        await db.FoodEntries.AsNoTracking().Where(f => f.AccountId == accountId).OrderBy(f => f.LoggedOn).ToListAsync(ct);

    public async Task<IReadOnlyList<StepSummary>> ListStepsAsync(Guid accountId, CancellationToken ct) =>
        await db.StepSummaries.AsNoTracking().Where(s => s.AccountId == accountId).OrderBy(s => s.OnDate).ToListAsync(ct);

    public async Task<int> UpsertStepsAsync(Guid accountId, IReadOnlyCollection<StepSummary> rows, CancellationToken ct)
    {
        var dates = rows.Select(r => r.OnDate).ToList();
        var existing = await db.StepSummaries.Where(s => s.AccountId == accountId && dates.Contains(s.OnDate))
            .ToDictionaryAsync(s => s.OnDate, ct);
        foreach (var r in rows)
        {
            if (existing.TryGetValue(r.OnDate, out var row))
            {
                row.Steps = r.Steps;
                row.BriskMinutes = r.BriskMinutes;
            }
            else db.StepSummaries.Add(r);
        }
        await db.SaveChangesAsync(ct);
        return rows.Count;
    }

    public async Task<int> UpsertSessionsAsync(Guid accountId, IReadOnlyCollection<SessionLog> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var known = await db.SessionLogs.AsNoTracking().Where(s => s.AccountId == accountId && ids.Contains(s.Id))
            .Select(s => s.Id).ToListAsync(ct);
        var fresh = rows.Where(r => !known.Contains(r.Id)).ToList();
        db.SessionLogs.AddRange(fresh);
        await db.SaveChangesAsync(ct);
        return fresh.Count;
    }

    public async Task<int> UpsertFoodAsync(Guid accountId, IReadOnlyCollection<FoodEntry> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var existing = await db.FoodEntries.Where(f => f.AccountId == accountId && ids.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, ct);
        foreach (var r in rows)
        {
            if (existing.TryGetValue(r.Id, out var row))
            {
                row.LoggedOn = r.LoggedOn;
                row.Meal = r.Meal;
                row.FoodId = r.FoodId;
                row.Portions = r.Portions;
            }
            else db.FoodEntries.Add(r);
        }
        await db.SaveChangesAsync(ct);
        return rows.Count;
    }

    public async Task DeleteAsync(Guid accountId, IReadOnlyCollection<DeletedIdentifierHash> hashes, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        foreach (var h in hashes)
        {
            var existing = await db.DeletedIdentifierHashes.FirstOrDefaultAsync(d => d.Hash == h.Hash, ct);
            if (existing is null) db.DeletedIdentifierHashes.Add(h);
            else
            {
                existing.DeletedAt = h.DeletedAt;
                existing.ExpiresAt = h.ExpiresAt;
            }
        }
        await db.SaveChangesAsync(ct);
        // Cascade deletes plan, consents, events, sessions, food and steps. OTP attempts keep only a null account id.
        await db.Accounts.Where(a => a.Id == accountId).ExecuteDeleteAsync(ct);
        await tx.CommitAsync(ct);
    }
}
