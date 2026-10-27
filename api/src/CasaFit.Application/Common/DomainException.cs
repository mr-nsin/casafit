namespace CasaFit.Application.Common;

/// <summary>A failure the API reports with a specific HTTP status and a machine-readable code.</summary>
public class DomainException(int status, string code, string detail) : Exception(detail)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
