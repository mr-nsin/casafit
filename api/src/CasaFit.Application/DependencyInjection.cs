using CasaFit.Application.Auth;
using Microsoft.Extensions.DependencyInjection;

namespace CasaFit.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddAuthModule(this IServiceCollection services)
    {
        services.AddScoped<AuthService>();
        return services;
    }
}
