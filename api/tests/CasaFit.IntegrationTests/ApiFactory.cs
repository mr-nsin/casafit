using CasaFit.Infrastructure.Auth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace CasaFit.IntegrationTests;

/// <summary>
/// Starts a throwaway Postgres 16 in Docker and hosts the real API against it.
/// Configuration goes in through environment variables, the same way a host such as Railway supplies it.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public const string WebhookSecret = "integration-webhook-secret";

    public string ConnectionString => _postgres.GetConnectionString();

    public DevOtpOutbox Outbox => Services.GetRequiredService<DevOtpOutbox>();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Secret", "integration-test-secret-0123456789-abcdef");
        Environment.SetEnvironmentVariable("Auth__Pepper", "integration-test-pepper-0123456789");
        Environment.SetEnvironmentVariable("RevenueCat__WebhookSecret", WebhookSecret);
        Environment.SetEnvironmentVariable("Sms__Provider", "log");
        Environment.SetEnvironmentVariable("Attestation__Provider", "dev");
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "true");
        Environment.SetEnvironmentVariable("Redis__Url", null);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
