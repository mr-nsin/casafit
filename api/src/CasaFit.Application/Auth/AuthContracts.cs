namespace CasaFit.Application.Auth;

public sealed record SendCodeRequest
{
    public string? Phone { get; init; }
    public string? Email { get; init; }
}

public sealed record SendCodeResponse(int ResendInSeconds, int AttemptsLeftThisHour);

public sealed record VerifyCodeRequest
{
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string Code { get; init; } = "";
}

public sealed record ProState(bool Active, DateTimeOffset? ExpiresAt);

public sealed record VerifyCodeResponse(
    string AccessToken,
    string RefreshToken,
    bool IsNewAccount,
    int FreeChecksRemaining,
    ProState Pro);

public sealed record TokenPair(string AccessToken, string RefreshToken);

public sealed record RefreshRequest
{
    public string RefreshToken { get; init; } = "";
}
