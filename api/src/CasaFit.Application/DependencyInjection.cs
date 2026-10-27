using CasaFit.Application.Accounts;
using CasaFit.Application.Auth;
using CasaFit.Application.Content;
using CasaFit.Application.Entitlements;
using Microsoft.Extensions.DependencyInjection;

namespace CasaFit.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddAuthModule(this IServiceCollection services)
    {
        services.AddScoped<AuthService>();
        services.AddScoped<RefreshService>();
        return services;
    }

    public static IServiceCollection AddPlatformModules(this IServiceCollection services)
    {
        services.AddScoped<AccountService>();
        services.AddScoped<SyncService>();
        services.AddScoped<EntitlementService>();
        services.AddScoped<RevenueCatWebhookService>();
        services.AddSingleton<ContentService>();
        return services;
    }
}
