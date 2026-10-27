namespace CasaFit.Domain.Auth;

/// <summary>
/// Written when an account is deleted, so the free-check loophole stays closed without keeping the raw identifier.
/// Expires 180 days after deletion (docs/data-model.md section 1).
/// </summary>
public sealed class DeletedIdentifierHash
{
    public byte[] Hash { get; set; } = [];
    public DateTimeOffset DeletedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
