using System.Collections.Concurrent;
using CasaFit.Application.Auth;

namespace CasaFit.Infrastructure.Auth;

/// <summary>
/// Single-instance OTP store for local runs and tests. Not safe behind more than one replica:
/// set Redis__Url in any deployed environment.
/// </summary>
public sealed class InMemoryOtpStore(TimeProvider clock) : IOtpStore
{
    private sealed class Code(byte[] hash, DateTimeOffset expires)
    {
        public byte[] Hash { get; } = hash;
        public DateTimeOffset Expires { get; } = expires;
        public int Tries;
    }

    private readonly ConcurrentDictionary<string, Code> _codes = new();
    private readonly ConcurrentDictionary<string, DateTimeOffset> _locks = new();
    private readonly ConcurrentDictionary<string, (int Count, DateTimeOffset Expires)> _counts = new();
    private readonly object _gate = new();

    public Task<SendWindow> GetSendWindowAsync(string key, CancellationToken ct)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            if (_counts.TryGetValue(key, out var c) && c.Expires > now)
                return Task.FromResult(new SendWindow(c.Count, Seconds(c.Expires - now)));
            return Task.FromResult(new SendWindow(0, 0));
        }
    }

    public Task<int> IncrementSendCountAsync(string key, CancellationToken ct)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            var next = _counts.TryGetValue(key, out var c) && c.Expires > now
                ? (c.Count + 1, c.Expires)
                : (1, now.AddHours(1));
            _counts[key] = next;
            return Task.FromResult(next.Item1);
        }
    }

    public Task<int> TryAcquireResendLockAsync(string key, TimeSpan duration, CancellationToken ct)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            if (_locks.TryGetValue(key, out var until) && until > now)
                return Task.FromResult(Seconds(until - now));
            _locks[key] = now + duration;
            return Task.FromResult(0);
        }
    }

    public Task SaveCodeAsync(string key, byte[] codeHash, TimeSpan ttl, CancellationToken ct)
    {
        _codes[key] = new Code(codeHash, clock.GetUtcNow() + ttl);
        return Task.CompletedTask;
    }

    public Task<OtpRecord?> GetCodeAsync(string key, CancellationToken ct)
    {
        if (_codes.TryGetValue(key, out var code))
        {
            if (code.Expires > clock.GetUtcNow())
                return Task.FromResult<OtpRecord?>(new OtpRecord(code.Hash, Volatile.Read(ref code.Tries)));
            _codes.TryRemove(key, out _);
        }
        return Task.FromResult<OtpRecord?>(null);
    }

    public Task<int> IncrementTriesAsync(string key, CancellationToken ct) =>
        Task.FromResult(_codes.TryGetValue(key, out var code) ? Interlocked.Increment(ref code.Tries) : 0);

    public Task DeleteCodeAsync(string key, CancellationToken ct)
    {
        _codes.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    private static int Seconds(TimeSpan span) => (int)Math.Ceiling(span.TotalSeconds);
}
