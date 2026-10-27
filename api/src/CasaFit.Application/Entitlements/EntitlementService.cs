using CasaFit.Application.Auth;
using CasaFit.Application.Common;
using CasaFit.Application.Common.Idempotency;
using CasaFit.Domain.Entitlements;
using Microsoft.Extensions.Logging;

namespace CasaFit.Application.Entitlements;

public sealed class EntitlementService(
    IEntitlementStore store,
    IFormCheckLedger ledger,
    TimeProvider clock,
    ILogger<EntitlementService> log)
{
    public async Task<EntitlementsStatus> GetStatusAsync(Guid accountId, CancellationToken ct)
    {
        var s = await RequireAsync(accountId, ct);
        return new EntitlementsStatus(s.FreeChecksRemaining, ProOf(s));
    }

    /// <summary>
    /// Spends one free check. Pro accounts spend nothing. A repeated key changes nothing and reports the current balance.
    /// At zero the answer is { ok: false, reason: "no_credits" } with a 200, per the offline rule in docs/data-model.md.
    /// </summary>
    public async Task<ConsumeResponse> ConsumeAsync(Guid accountId, ConsumeRequest request, CancellationToken ct)
    {
        var snapshot = await RequireAsync(accountId, ct);
        if (ProOf(snapshot).Active)
            return new ConsumeResponse { Ok = false, Reason = "pro_active" };

        var outcome = await store.RunAtomicAsync(async token =>
        {
            var recorded = await ledger.RecordAsync(accountId, FormCheckKind.Consume, request.IdempotencyKey, token);
            if (recorded == IdempotencyResult.Duplicate)
                return new AtomicResult<ConsumeOutcome>(ConsumeOutcome.Replay, false);
            if (!await store.TryDecrementAsync(accountId, token))
                return new AtomicResult<ConsumeOutcome>(ConsumeOutcome.NoCredits, false); // rolls the event back
            return new AtomicResult<ConsumeOutcome>(ConsumeOutcome.Spent, true);
        }, ct);

        if (outcome == ConsumeOutcome.NoCredits)
        {
            log.LogInformation("Consume refused for account {AccountId}: no credits", accountId);
            return new ConsumeResponse { Ok = false, Reason = "no_credits" };
        }

        var after = await RequireAsync(accountId, ct);
        return new ConsumeResponse { Ok = true, FreeChecksRemaining = after.FreeChecksRemaining };
    }

    /// <summary>
    /// Gives back one free check for a consume made earlier. Legal only before rep 3 (D5), once per consume,
    /// and never above the lifetime allowance of 2.
    /// </summary>
    public async Task<RefundResponse> RefundAsync(Guid accountId, RefundRequest request, CancellationToken ct)
    {
        if (request.RepsCompleted >= EntitlementRules.RefundBeforeRep)
            throw new DomainException(409, "refund_window_closed", "A free check cannot be given back once rep 3 is reached.");

        await RequireAsync(accountId, ct);

        await store.RunAtomicAsync(async token =>
        {
            if (!await store.ConsumeExistsAsync(accountId, request.ConsumeIdempotencyKey, token))
                throw new DomainException(409, "unknown_consume", "There is no matching free check to give back.");

            var existing = await store.FindRefundKeyAsync(accountId, request.ConsumeIdempotencyKey, token);
            if (existing is not null)
            {
                if (existing == request.IdempotencyKey)
                    return new AtomicResult<bool>(false, false); // replay
                throw new DomainException(409, "already_refunded", "This free check was already given back.");
            }

            var recorded = await ledger.RecordAsync(
                accountId, FormCheckKind.Refund, request.IdempotencyKey, token, request.ConsumeIdempotencyKey);
            if (recorded == IdempotencyResult.Duplicate)
                return new AtomicResult<bool>(false, false);

            if (!await store.TryIncrementAsync(accountId, EntitlementRules.FreeChecksForLife, token))
                return new AtomicResult<bool>(false, false); // already at the cap: nothing to give back
            return new AtomicResult<bool>(true, true);
        }, ct);

        var after = await RequireAsync(accountId, ct);
        return new RefundResponse(true, after.FreeChecksRemaining);
    }

    private async Task<EntitlementSnapshot> RequireAsync(Guid accountId, CancellationToken ct) =>
        await store.GetAsync(accountId, ct)
        ?? throw new DomainException(AuthStatus.Unauthorized, "account_not_found", "This account no longer exists. Sign in again.");

    private ProState ProOf(EntitlementSnapshot s) =>
        EntitlementRules.ProOf(s.ProActive, s.ProExpiresAt, clock.GetUtcNow());

    private enum ConsumeOutcome { Spent, Replay, NoCredits }
}
