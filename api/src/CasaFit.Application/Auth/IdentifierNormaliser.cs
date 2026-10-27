using System.Text.RegularExpressions;
using CasaFit.Domain.Accounts;

namespace CasaFit.Application.Auth;

/// <summary>
/// Identifier normalisation. Must stay equivalent to shared/src/identifiers.ts and pass
/// shared/fixtures/identifiers.json. Rules: docs/data-model.md section 1.
/// </summary>
public static partial class IdentifierNormaliser
{
    private static readonly HashSet<string> DisposableEmailDomains = new(StringComparer.Ordinal)
    {
        "mailinator.com",
        "guerrillamail.com",
        "10minutemail.com",
        "temp-mail.org",
        "yopmail.com",
    };

    [GeneratedRegex(@"[\s()\-]")]
    private static partial Regex PhoneNoise();

    [GeneratedRegex(@"^\+\d{8,15}$")]
    private static partial Regex E164();

    /// <summary>Normalises to E.164. A bare 10-digit number is treated as Indian (+91).</summary>
    public static bool TryNormalisePhone(string? input, out string normalised)
    {
        normalised = "";
        if (string.IsNullOrWhiteSpace(input)) return false;

        var trimmed = PhoneNoise().Replace(input, "");
        if (!trimmed.StartsWith('+'))
        {
            if (trimmed.Length != 10 || !trimmed.All(char.IsAsciiDigit)) return false;
            trimmed = "+91" + trimmed;
        }

        if (!E164().IsMatch(trimmed)) return false;
        normalised = trimmed;
        return true;
    }

    /// <summary>Lower-cases, strips +tags, strips Gmail dots, rejects disposable domains.</summary>
    public static bool TryNormaliseEmail(string? input, out string normalised)
    {
        normalised = "";
        if (string.IsNullOrWhiteSpace(input)) return false;

        var parts = input.Trim().ToLowerInvariant().Split('@');
        if (parts.Length != 2) return false;

        var (rawLocal, domain) = (parts[0], parts[1]);
        if (rawLocal.Length == 0 || domain.Length == 0) return false;
        if (DisposableEmailDomains.Contains(domain)) return false;

        var local = rawLocal.Split('+')[0];
        if (domain == "gmail.com") local = local.Replace(".", "");
        if (local.Length == 0) return false;

        normalised = $"{local}@{domain}";
        return true;
    }

    public static bool TryNormalise(IdentifierKind kind, string? input, out string normalised) =>
        kind == IdentifierKind.Phone
            ? TryNormalisePhone(input, out normalised)
            : TryNormaliseEmail(input, out normalised);
}
