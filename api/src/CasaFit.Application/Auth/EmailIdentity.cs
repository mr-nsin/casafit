namespace CasaFit.Application.Auth;

/// <summary>
/// Email helpers. <see cref="Canonical"/> is used only to hash an email for the deleted-identifier list, so
/// a.s.h.a+gym@gmail.com and asha@gmail.com count as one person. The stored Email column is just lower-cased.
/// </summary>
public static class EmailIdentity
{
    public static string Lower(string email) => email.Trim().ToLowerInvariant();

    /// <summary>Lower-cases, strips +tags, strips Gmail dots.</summary>
    public static string Canonical(string email)
    {
        var lower = Lower(email);
        var at = lower.LastIndexOf('@');
        if (at <= 0 || at == lower.Length - 1) return lower;

        var local = lower[..at].Split('+')[0];
        var domain = lower[(at + 1)..];
        if (domain is "gmail.com" or "googlemail.com") local = local.Replace(".", "");
        return local.Length == 0 ? lower : $"{local}@{domain}";
    }

    /// <summary>nitin@gmail.com becomes n***@gmail.com.</summary>
    public static string? Mask(string? email)
    {
        if (string.IsNullOrEmpty(email)) return null;
        var at = email.LastIndexOf('@');
        if (at <= 0) return "***";
        return $"{email[0]}***{email[at..]}";
    }
}
