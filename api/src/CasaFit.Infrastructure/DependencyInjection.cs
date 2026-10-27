using CasaFit.Application.Auth;
using CasaFit.Application.Common.Idempotency;
using CasaFit.Infrastructure.Auth;
using CasaFit.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using StackExchange.Redis;

namespace CasaFit.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Everything is configured from environment variables (or appsettings): ConnectionStrings__Default,
    /// Redis__Url, Jwt__*, Auth__Pepper, Sms__Provider, Attestation__Provider.
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

        // The OpenAPI build step starts the host without configuration; skip the fail-fast check there only.
        var generatingDocs = System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

        var jwt = services.AddOptions<JwtOptions>().Bind(config.GetSection(JwtOptions.Section))
            .Validate<IHostEnvironment>(
                (o, env) => o.Secret.Length >= 32 && (env.IsDevelopment() || !o.Secret.StartsWith("change-me", StringComparison.Ordinal)),
                "Jwt__Secret must be at least 32 characters and must not be the example value.");
        var auth = services.AddOptions<AuthOptions>().Bind(config.GetSection(AuthOptions.Section))
            .Validate<IHostEnvironment>(
                (o, env) => o.Pepper.Length >= 16 && (env.IsDevelopment() || !o.Pepper.StartsWith("change-me", StringComparison.Ordinal)),
                "Auth__Pepper must be at least 16 characters and must not be the example value.");
        if (!generatingDocs)
        {
            jwt.ValidateOnStart();
            auth.ValidateOnStart();
        }
        services.AddSingleton<ITokenService, JwtTokenService>();

        var redisUrl = config["Redis:Url"];
        if (string.IsNullOrWhiteSpace(redisUrl))
        {
            services.AddSingleton<IOtpStore, InMemoryOtpStore>();
        }
        else
        {
            services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(RedisUrl.ToOptions(redisUrl)));
            services.AddSingleton<IOtpStore, RedisOtpStore>();
        }

        // Vendors are explicit opt-ins. Only the dev fakes exist until the DLT-registered SMS vendor is chosen.
        services.AddSingleton<DevOtpOutbox>();
        services.AddSingleton<IOtpSender>(sp =>
        {
            if (!string.Equals(config["Sms:Provider"], "log", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    "Sms__Provider is not set to a supported value. Only 'log' (dev fake, no vendor call) exists so far.");
            return ActivatorUtilities.CreateInstance<DevOtpSender>(sp);
        });
        services.AddSingleton<IAttestationVerifier>(_ =>
        {
            if (!string.Equals(config["Attestation:Provider"], "dev", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException(
                    "Attestation__Provider is not set to a supported value. Only 'dev' (accepts everything) exists so far.");
            return new DevAttestationVerifier();
        });

        return services;
    }
}

internal static class RedisUrl
{
    /// <summary>Accepts redis://[user:pass@]host:port and rediss:// (TLS), and plain StackExchange strings.</summary>
    public static ConfigurationOptions ToOptions(string url)
    {
        if (!url.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
            return ConfigurationOptions.Parse(url);

        var uri = new Uri(url);
        var options = new ConfigurationOptions { AbortOnConnectFail = false, Ssl = uri.Scheme == "rediss" };
        options.EndPoints.Add(uri.Host, uri.Port > 0 ? uri.Port : 6379);
        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var parts = uri.UserInfo.Split(':', 2);
            if (parts.Length == 2)
            {
                if (parts[0].Length > 0) options.User = Uri.UnescapeDataString(parts[0]);
                options.Password = Uri.UnescapeDataString(parts[1]);
            }
            else options.Password = Uri.UnescapeDataString(parts[0]);
        }
        return options;
    }
}
