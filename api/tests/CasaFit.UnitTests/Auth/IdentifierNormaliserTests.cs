using System.Text.Json;
using CasaFit.Application.Auth;

namespace CasaFit.UnitTests.Auth;

public class IdentifierNormaliserTests
{
    public sealed record Vector(string Input, string? Expected);

    private sealed record Fixture(List<Vector> Phone, List<Vector> Email);

    private static Fixture Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "identifiers.json");
        return JsonSerializer.Deserialize<Fixture>(
            File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
    }

    public static TheoryData<string, string?> PhoneVectors()
    {
        var data = new TheoryData<string, string?>();
        foreach (var v in Load().Phone) data.Add(v.Input, v.Expected);
        return data;
    }

    public static TheoryData<string, string?> EmailVectors()
    {
        var data = new TheoryData<string, string?>();
        foreach (var v in Load().Email) data.Add(v.Input, v.Expected);
        return data;
    }

    [Theory]
    [MemberData(nameof(PhoneVectors))]
    public void Phone_matches_shared_vectors(string input, string? expected)
    {
        var ok = IdentifierNormaliser.TryNormalisePhone(input, out var actual);
        Assert.Equal(expected is not null, ok);
        if (expected is not null) Assert.Equal(expected, actual);
    }

    [Theory]
    [MemberData(nameof(EmailVectors))]
    public void Email_matches_shared_vectors(string input, string? expected)
    {
        var ok = IdentifierNormaliser.TryNormaliseEmail(input, out var actual);
        Assert.Equal(expected is not null, ok);
        if (expected is not null) Assert.Equal(expected, actual);
    }

    [Fact]
    public void Fixture_is_not_empty()
    {
        var f = Load();
        Assert.NotEmpty(f.Phone);
        Assert.NotEmpty(f.Email);
    }
}
