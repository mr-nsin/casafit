using CasaFit.Application.Entitlements;

namespace CasaFit.Application.Content;

/// <summary>Stub until the content pipeline lands: the bundled packs are version 1.</summary>
public sealed class ContentService
{
    public ContentVersionResponse GetVersion() => new(FoodPack: 1, Exercises: 1);
}
