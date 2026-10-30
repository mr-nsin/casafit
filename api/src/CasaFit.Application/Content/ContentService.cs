using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using CasaFit.Application.Common;
using CasaFit.Application.Entitlements;
using Microsoft.Extensions.Options;

namespace CasaFit.Application.Content;

public sealed class ContentOptions
{
    public const string Section = "Content";

    /// <summary>Folder holding the pack files (exercises.json, plans.json, foods.json, learn.json). Content__Directory.</summary>
    public string Directory { get; set; } = "content";
}

/// <param name="ETag">Strong validator including the quotes, derived from the body.</param>
public sealed record ContentPack(string Name, byte[] Body, string ETag, DateTimeOffset LastModified);

/// <summary>
/// Serves the versioned JSON packs. The request name is looked up in a fixed table and never touches a path, so
/// there is nothing to traverse. Myths and concepts are slices of learn.json.
/// </summary>
public sealed class ContentService(IOptions<ContentOptions> options)
{
    /// <summary>Pack name to (file, property to slice out of the file, or null for the whole file).</summary>
    private static readonly IReadOnlyDictionary<string, (string File, string? Slice)> Packs =
        new Dictionary<string, (string, string?)>(StringComparer.Ordinal)
        {
            ["exercises"] = ("exercises.json", null),
            ["plans"] = ("plans.json", null),
            ["foods"] = ("foods.json", null),
            ["myths"] = ("learn.json", "myths"),
            ["concepts"] = ("learn.json", "concepts"),
        };

    private readonly ConcurrentDictionary<string, (DateTime Stamp, long Length, ContentPack Pack)> _cache = new();

    public static IReadOnlyCollection<string> Names => Packs.Keys.ToList();

    /// <summary>Stub until the content pipeline lands: the bundled packs are version 1.</summary>
    public ContentVersionResponse GetVersion() => new(FoodPack: 1, Exercises: 1);

    /// <summary>Throws a 404 DomainException for a name outside the whitelist or a pack file that is not deployed.</summary>
    public async Task<ContentPack> GetPackAsync(string name, CancellationToken ct)
    {
        if (!Packs.TryGetValue(name, out var entry))
            throw new DomainException(404, "pack_not_found", "There is no content pack with that name.");

        var path = Path.Combine(options.Value.Directory, entry.File);
        var info = new FileInfo(path);
        if (!info.Exists)
            throw new DomainException(404, "pack_not_found", "That content pack is not available.");

        if (_cache.TryGetValue(name, out var hit) && hit.Stamp == info.LastWriteTimeUtc && hit.Length == info.Length)
            return hit.Pack;

        var bytes = await File.ReadAllBytesAsync(path, ct);
        if (entry.Slice is not null) bytes = Slice(bytes, name, entry.Slice);

        var etag = "\"" + Convert.ToHexString(SHA256.HashData(bytes))[..32].ToLowerInvariant() + "\"";
        var pack = new ContentPack(name, bytes, etag, new DateTimeOffset(info.LastWriteTimeUtc, TimeSpan.Zero));
        _cache[name] = (info.LastWriteTimeUtc, info.Length, pack);
        return pack;
    }

    private static byte[] Slice(byte[] source, string name, string property)
    {
        var root = JsonNode.Parse(source)?.AsObject()
                   ?? throw new DomainException(404, "pack_not_found", "That content pack is not available.");
        var sliced = new JsonObject
        {
            ["schemaVersion"] = root["schemaVersion"]?.DeepClone(),
            ["contentType"] = name,
            ["packVersion"] = root["packVersion"]?.DeepClone(),
            ["needsExpertReview"] = root["needsExpertReview"]?.DeepClone(),
            ["reviewNotes"] = root["reviewNotes"]?.DeepClone(),
            [property] = root[property]?.DeepClone() ?? new JsonArray(),
        };
        return JsonSerializer.SerializeToUtf8Bytes(sliced);
    }
}
