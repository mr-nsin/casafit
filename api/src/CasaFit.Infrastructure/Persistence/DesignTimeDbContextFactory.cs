using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CasaFit.Infrastructure.Persistence;

/// <summary>Used only by `dotnet ef`. Needs no running database to add a migration.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<CasaFitDbContext>
{
    public CasaFitDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
                 ?? "Host=localhost;Port=5432;Database=casafit;Username=casafit;Password=casafit";
        var options = new DbContextOptionsBuilder<CasaFitDbContext>()
            .UseNpgsql(ConnectionStringConverter.ToNpgsql(cs))
            .Options;
        return new CasaFitDbContext(options);
    }
}
