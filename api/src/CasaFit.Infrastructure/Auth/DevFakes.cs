using System.Collections.Concurrent;
using CasaFit.Application.Auth;
using CasaFit.Domain.Accounts;
using Microsoft.Extensions.Logging;

namespace CasaFit.Infrastructure.Auth;

/// <summary>Keeps the last code per destination so tests and local dev can read it. Never registered with a real sender.</summary>
public sealed class DevOtpOutbox
{
    private readonly ConcurrentDictionary<string, string> _last = new();

    public void Put(string destination, string code) => _last[destination] = code;
    public string? LastCodeFor(string destination) => _last.GetValueOrDefault(destination);
}

/// <summary>
/// Dev SMS and email sender. Makes no vendor call. Logs the code with the destination masked,
/// so a phone number never appears in the clear. Enabled with Sms__Provider=log.
/// </summary>
public sealed class DevOtpSender(DevOtpOutbox outbox, ILogger<DevOtpSender> log) : IOtpSender
{
    public Task SendAsync(IdentifierKind kind, string destination, string code, CancellationToken ct)
    {
        outbox.Put(destination, code);
        log.LogWarning("[dev sender] {Kind} code {Code} for {Destination}", kind, code, Mask(destination));
        return Task.CompletedTask;
    }

    private static string Mask(string value) =>
        value.Length <= 4 ? "****" : new string('*', value.Length - 3) + value[^3..];
}

/// <summary>Accepts every request. Replaced by Play Integrity and App Attest verifiers before launch.</summary>
public sealed class DevAttestationVerifier : IAttestationVerifier
{
    public Task<bool> VerifyAsync(string? token, CancellationToken ct) => Task.FromResult(true);
}
