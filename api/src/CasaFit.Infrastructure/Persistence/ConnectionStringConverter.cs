namespace CasaFit.Infrastructure.Persistence;

/// <summary>
/// Hosts such as Railway, Supabase and Heroku hand out postgres://user:pass@host:port/db URLs.
/// Npgsql wants key=value pairs, so accept both.
/// </summary>
public static class ConnectionStringConverter
{
    public static string ToNpgsql(string value)
    {
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return value;

        var uri = new Uri(value);
        var user = uri.UserInfo.Split(':', 2);
        var parts = new List<string>
        {
            $"Host={uri.Host}",
            $"Port={(uri.Port > 0 ? uri.Port : 5432)}",
            $"Database={uri.AbsolutePath.TrimStart('/')}",
            $"Username={Uri.UnescapeDataString(user[0])}",
        };
        if (user.Length > 1) parts.Add($"Password={Uri.UnescapeDataString(user[1])}");

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                parts.Add($"SSL Mode={kv[1]}");
        }

        return string.Join(';', parts);
    }
}
