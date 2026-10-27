using CasaFit.Application.Common.Idempotency;
using CasaFit.Domain.Entitlements;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CasaFit.Infrastructure.Persistence;

public sealed class EfFormCheckLedger(CasaFitDbContext db, TimeProvider clock) : IFormCheckLedger
{
    public async Task<IdempotencyResult> RecordAsync(
        Guid accountId, FormCheckKind kind, string idempotencyKey, CancellationToken ct)
    {
        var entry = new FormCheckEvent
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Kind = kind,
            IdempotencyKey = idempotencyKey,
            At = clock.GetUtcNow(),
        };

        db.FormCheckEvents.Add(entry);
        try
        {
            await db.SaveChangesAsync(ct);
            return IdempotencyResult.Recorded;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(entry).State = EntityState.Detached;
            return IdempotencyResult.Duplicate;
        }
    }
}
