using CasaFit.Application.Auth;
using StackExchange.Redis;

namespace CasaFit.Infrastructure.Auth;

/// <summary>Redis-backed OTP state. Safe across replicas. Works with Upstash over TLS (rediss://).</summary>
public sealed class RedisOtpStore(IConnectionMultiplexer redis) : IOtpStore
{
    private static readonly TimeSpan SendWindowLength = TimeSpan.FromHours(1);

    private IDatabase Db => redis.GetDatabase();

    private static RedisKey Code(string k) => $"otp:code:{k}";
    private static RedisKey Lock(string k) => $"otp:lock:{k}";
    private static RedisKey Count(string k) => $"otp:cnt:{k}";

    public async Task<SendWindow> GetSendWindowAsync(string key, CancellationToken ct)
    {
        var value = await Db.StringGetAsync(Count(key));
        if (value.IsNullOrEmpty) return new SendWindow(0, 0);
        var ttl = await Db.KeyTimeToLiveAsync(Count(key));
        return new SendWindow((int)value, ttl is null ? 0 : (int)Math.Ceiling(ttl.Value.TotalSeconds));
    }

    public async Task<int> IncrementSendCountAsync(string key, CancellationToken ct)
    {
        var count = await Db.StringIncrementAsync(Count(key));
        if (count == 1) await Db.KeyExpireAsync(Count(key), SendWindowLength);
        return (int)count;
    }

    public async Task<int> TryAcquireResendLockAsync(string key, TimeSpan duration, CancellationToken ct)
    {
        if (await Db.StringSetAsync(Lock(key), "1", duration, When.NotExists)) return 0;
        var ttl = await Db.KeyTimeToLiveAsync(Lock(key));
        return ttl is null ? 1 : (int)Math.Ceiling(ttl.Value.TotalSeconds);
    }

    public async Task SaveCodeAsync(string key, byte[] codeHash, TimeSpan ttl, CancellationToken ct)
    {
        await Db.HashSetAsync(Code(key), [new HashEntry("h", codeHash), new HashEntry("t", 0)]);
        await Db.KeyExpireAsync(Code(key), ttl);
    }

    public async Task<OtpRecord?> GetCodeAsync(string key, CancellationToken ct)
    {
        var entries = await Db.HashGetAllAsync(Code(key));
        if (entries.Length == 0) return null;
        var hash = (byte[]?)entries.FirstOrDefault(e => e.Name == "h").Value;
        var tries = (int)entries.FirstOrDefault(e => e.Name == "t").Value;
        return hash is null ? null : new OtpRecord(hash, tries);
    }

    public async Task<int> IncrementTriesAsync(string key, CancellationToken ct) =>
        (int)await Db.HashIncrementAsync(Code(key), "t");

    public async Task DeleteCodeAsync(string key, CancellationToken ct) =>
        await Db.KeyDeleteAsync(Code(key));
}
