using CasaFit.Application.Accounts;
using CasaFit.Application.Auth;
using CasaFit.Application.Entitlements;
using CasaFit.Application.Common.Idempotency;
using CasaFit.Infrastructure.Auth;
using CasaFit.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace CasaFit.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Everything is configured from environment variables (or appsettings): ConnectionStrings__Default,
    /// Supabase__Url, Supabase__JwtSecret, Supabase__ServiceRoleKey, Auth__Pepper, RevenueCat__WebhookSecret,
    /// Content__Directory.
    /// </summary>
    public static IServiceCollection AddAuthInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        // Everything below resolves lazily, so tooling that builds the host without starting it
        // (OpenAPI generation, dotnet ef) does not need a full configuration.
        services.AddDbContext<CasaFitDbContext>(o =>
        {
            var cs = config.GetConnectionString("Default")
                     ?? throw new InvalidOperationException("ConnectionStrings__Default is not set.");
            o.UseNpgsql(ConnectionStringConverter.ToNpgsql(cs));
        });
        services.AddScoped<IAuthStore, EfAuthStore>();
        services.AddScoped<IFormCheckLedger, EfFormCheckLedger>();
        services.AddScoped<IAccountStore, EfAccountStore>();
        services.AddScoped<IEntitlementStore, EfEntitlementStore>();
        services.AddOptions<RevenueCatOptions>().Bind(config.GetSection(RevenueCatOptions.Section));

        // The OpenAPI build step starts the host without configuration; skip the fail-fast check there only.
        var generatingDocs = System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

        var supabase = services.AddOptions<SupabaseOptions>().Bind(config.GetSection(SupabaseOptions.Section))
            .Validate(o => Uri.TryCreate(o.Url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.IsLoopback),
                "Supabase__Url must be the project URL, for example https://abcd.supabase.co.")
            .Validate(o => o.JwtSecret.Length == 0 || o.JwtSecret.Length >= 32,
                "Supabase__JwtSecret, when set, must be at least 32 characters.")
            .Validate<IHostEnvironment>(
                (o, env) => env.IsDevelopment() || o.ServiceRoleKey.Length > 0,
                "Supabase__ServiceRoleKey must be set outside Development (it deletes users).");
        var auth = services.AddOptions<AuthOptions>().Bind(config.GetSection(AuthOptions.Section))
            .Validate<IHostEnvironment>(
                (o, env) => o.Pepper.Length >= 16 && (env.IsDevelopment() || !o.Pepper.StartsWith("change-me", StringComparison.Ordinal)),
                "Auth__Pepper must be at least 16 characters and must not be the example value.");
        if (!generatingDocs)
        {
            supabase.ValidateOnStart();
            auth.ValidateOnStart();
        }

        services.AddSingleton<SupabaseSigningKeys>();
        services.AddSingleton<IIdentityAdmin, SupabaseIdentityAdmin>();

        return services;
    }
}
