using System.Text.Json;
using CasaFit.Application.Common;
using CasaFit.Application.Content;
using Microsoft.Extensions.Options;

namespace CasaFit.UnitTests.Content;

public sealed class ContentServiceTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "casafit-content-" + Guid.NewGuid().ToString("N"));
    private readonly ContentService _sut;

    public ContentServiceTests()
    {
        Directory.CreateDirectory(_dir);
        File.WriteAllText(Path.Combine(_dir, "exercises.json"), """{"schemaVersion":1,"packVersion":1,"exercises":[{"id":"squat"}]}""");
        File.WriteAllText(Path.Combine(_dir, "learn.json"),
            """{"schemaVersion":1,"packVersion":2,"needsExpertReview":true,"reviewNotes":"n","myths":[{"id":"m1"}],"concepts":[{"id":"c1"},{"id":"c2"}]}""");
        File.WriteAllText(Path.Combine(_dir, "secret.txt"), "do not serve");
        _sut = new ContentService(Options.Create(new ContentOptions { Directory = _dir }));
    }

    public void Dispose() => Directory.Delete(_dir, true);

    [Fact]
    public async Task A_pack_is_returned_with_a_stable_quoted_etag()
    {
        var a = await _sut.GetPackAsync("exercises", default);
        var b = await _sut.GetPackAsync("exercises", default);

        Assert.Equal(a.ETag, b.ETag);
        Assert.StartsWith("\"", a.ETag);
        Assert.EndsWith("\"", a.ETag);
        Assert.Contains("squat", System.Text.Encoding.UTF8.GetString(a.Body));
    }

    [Fact]
    public async Task The_etag_changes_when_the_file_changes()
    {
        var before = await _sut.GetPackAsync("exercises", default);
        var path = Path.Combine(_dir, "exercises.json");
        File.WriteAllText(path, """{"schemaVersion":1,"packVersion":2,"exercises":[]}""");
        File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddMinutes(5));

        var after = await _sut.GetPackAsync("exercises", default);

        Assert.NotEqual(before.ETag, after.ETag);
    }

    [Fact]
    public async Task Myths_and_concepts_are_slices_of_the_learn_file()
    {
        var myths = JsonDocument.Parse((await _sut.GetPackAsync("myths", default)).Body).RootElement;
        var concepts = JsonDocument.Parse((await _sut.GetPackAsync("concepts", default)).Body).RootElement;

        Assert.Equal(1, myths.GetProperty("myths").GetArrayLength());
        Assert.False(myths.TryGetProperty("concepts", out _));
        Assert.Equal(2, concepts.GetProperty("concepts").GetArrayLength());
        Assert.Equal(2, concepts.GetProperty("packVersion").GetInt32());
    }

    [Theory]
    [InlineData("nope")]
    [InlineData("learn")]
    [InlineData("secret")]
    [InlineData("secret.txt")]
    [InlineData("../secret.txt")]
    [InlineData("..%2fsecret.txt")]
    [InlineData("..\\secret.txt")]
    [InlineData("/etc/passwd")]
    [InlineData("exercises.json")]
    [InlineData("EXERCISES")]
    [InlineData("")]
    public async Task Names_outside_the_whitelist_are_404(string name)
    {
        var ex = await Assert.ThrowsAsync<DomainException>(() => _sut.GetPackAsync(name, default));
        Assert.Equal(404, ex.Status);
    }

    [Fact]
    public async Task A_whitelisted_pack_whose_file_is_not_deployed_is_404()
    {
        var ex = await Assert.ThrowsAsync<DomainException>(() => _sut.GetPackAsync("foods", default));
        Assert.Equal(404, ex.Status);
    }
}
