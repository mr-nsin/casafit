using CasaFit.Application.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace CasaFit.IntegrationTests;

/// <summary>
/// Starts a throwaway Postgres 16 in Docker and hosts the real API against it.
/// Configuration goes in through environment variables, the same way a host such as Railway supplies it.
/// No real Supabase is needed: tokens are signed with a test secret and the admin API is a fake.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public const string WebhookSecret = "integration-webhook-secret";
    public const string Pepper = "integration-test-pepper-0123456789";

    public string ConnectionString => _postgres.GetConnectionString();

    public FakeIdentityAdmin IdentityAdmin { get; } = new();

    public string ContentDirectory { get; } = Path.Combine(Path.GetTempPath(), "casafit-it-content-" + Guid.NewGuid().ToString("N"));

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(ContentDirectory);
        File.WriteAllText(Path.Combine(ContentDirectory, "exercises.json"), """{"schemaVersion":1,"packVersion":1,"exercises":[{"id":"squat"}]}""");
        File.WriteAllText(Path.Combine(ContentDirectory, "learn.json"), """{"schemaVersion":1,"packVersion":1,"myths":[{"id":"m1"}],"concepts":[]}""");
        File.WriteAllText(Path.Combine(ContentDirectory, "secret.txt"), "never served");

        await _postgres.StartAsync();
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Supabase__Url", TestTokens.Url);
        Environment.SetEnvironmentVariable("Supabase__JwtSecret", TestTokens.Secret);
        Environment.SetEnvironmentVariable("Supabase__ServiceRoleKey", "integration-service-role-key");
        Environment.SetEnvironmentVariable("Auth__Pepper", Pepper);
        Environment.SetEnvironmentVariable("RevenueCat__WebhookSecret", WebhookSecret);
        Environment.SetEnvironmentVariable("Content__Directory", ContentDirectory);
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "true");
        // Every test calls from the same address; the production limit would trip the suite.
        Environment.SetEnvironmentVariable("RateLimit__PerMinute", "100000");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IIdentityAdmin>();
            services.AddSingleton<IIdentityAdmin>(IdentityAdmin);
        });

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        if (Directory.Exists(ContentDirectory)) Directory.Delete(ContentDirectory, true);
    }
}

/// <summary>Stands in for the Supabase admin API: records deletes, and can be told to fail.</summary>
public sealed class FakeIdentityAdmin : IIdentityAdmin
{
    private readonly object _gate = new();
    private readonly List<string> _deleted = [];

    public bool Fail { get; set; }

    public IReadOnlyList<string> Deleted { get { lock (_gate) return _deleted.ToList(); } }

    public Task DeleteUserAsync(string externalId, CancellationToken ct)
    {
        if (Fail) throw new IdentityAdminException("fake failure");
        lock (_gate) _deleted.Add(externalId);
        return Task.CompletedTask;
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
