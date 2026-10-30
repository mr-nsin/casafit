using System.Net;
using CasaFit.Application.Common.Idempotency;
using CasaFit.Domain.Accounts;
using CasaFit.Domain.Entitlements;
using CasaFit.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace CasaFit.IntegrationTests;

[Collection(ApiCollection.Name)]
public class PlatformEndpointsTests(ApiFactory factory)
{
    [Fact]
    public async Task Healthz_is_anonymous_and_returns_200()
    {
        var res = await factory.CreateClient().GetAsync("/healthz");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task OpenApi_document_is_served_anonymously_and_lists_the_endpoints_and_no_auth_routes()
    {
        var res = await factory.CreateClient().GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadAsStringAsync();
        Assert.Contains("/v1/me", json);
        Assert.Contains("/v1/content/packs/{name}", json);
        Assert.DoesNotContain("/v1/auth/", json);
    }

    [Fact]
    public async Task Unknown_routes_do_not_leak_anything_anonymous()
    {
        var res = await factory.CreateClient().GetAsync("/v1/me");
        Assert.True(res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Form_check_ledger_enforces_the_unique_idempotency_key()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CasaFitDbContext>();
        var account = new Account { Id = Guid.NewGuid(), CreatedAt = DateTimeOffset.UtcNow, ExternalId = Guid.NewGuid().ToString() };
        db.Accounts.Add(account);
        await db.SaveChangesAsync();

        var ledger = scope.ServiceProvider.GetRequiredService<IFormCheckLedger>();
        var key = Guid.NewGuid().ToString();

        Assert.Equal(IdempotencyResult.Recorded, await ledger.RecordAsync(account.Id, FormCheckKind.Consume, key, default));
        Assert.Equal(IdempotencyResult.Duplicate, await ledger.RecordAsync(account.Id, FormCheckKind.Consume, key, default));
        // Same key on a different kind is a different event.
        Assert.Equal(IdempotencyResult.Recorded, await ledger.RecordAsync(account.Id, FormCheckKind.Refund, key, default));
    }
}
