using System.Text;
using CasaFit.Domain.Accounts;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CasaFit.Application.Auth;

/// <summary>Creates the local account the first time a valid Supabase token is seen.</summary>
public sealed class AccountProvisioner(IAuthStore store, IOptions<AuthOptions> options, ILogger<AccountProvisioner> log)
{
    private readonly byte[] _pepper = Encoding.UTF8.GetBytes(options.Value.Pepper);

    public async Task<ProvisionResult> EnsureAsync(ExternalIdentity identity, CancellationToken ct)
    {
        // The user deleted the account but the token has not expired yet: do not bring it back.
        if (await store.IsDeletedIdentifierAsync(IdentifierHasher.ForExternalId(_pepper, identity.ExternalId), ct))
            return new ProvisionResult(null, true);

        var existing = await store.FindByExternalIdAsync(identity.ExternalId, ct);
        if (existing is not null && existing.Email == identity.Email && existing.Provider == identity.Provider)
            return new ProvisionResult(existing.Id, false);

        // A recently deleted email does not get a fresh batch of free checks.
        var freeChecks = Account.FreeChecksForLife;
        if (existing is null && identity.Email is not null &&
            await store.IsDeletedIdentifierAsync(IdentifierHasher.ForEmail(_pepper, identity.Email), ct))
            freeChecks = 0;

        var account = await store.GetOrCreateByExternalIdAsync(identity, freeChecks, ct);
        if (existing is null) log.LogInformation("Provisioned account {AccountId} via {Provider}", account.Id, account.Provider);
        return new ProvisionResult(account.Id, false);
    }
}
