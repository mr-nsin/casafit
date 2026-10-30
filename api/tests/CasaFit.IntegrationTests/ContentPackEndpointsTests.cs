using System.Net;
using System.Net.Http.Headers;

namespace CasaFit.IntegrationTests;

[Collection(ApiCollection.Name)]
public class ContentPackEndpointsTests(ApiFactory factory)
{
    [Fact]
    public async Task A_pack_needs_a_token()
    {
        var res = await TestUser.ClientFor(factory, null).GetAsync("/v1/content/packs/exercises");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task A_pack_is_served_with_etag_and_cache_control()
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.GetAsync("/v1/content/packs/exercises");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("application/json", res.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(res.Headers.ETag);
        Assert.Contains("max-age=3600", res.Headers.CacheControl!.ToString());
        Assert.Contains("squat", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task If_None_Match_with_the_current_etag_is_304_with_no_body()
    {
        var user = await TestUser.SignInAsync(factory);
        var first = await user.Client.GetAsync("/v1/content/packs/exercises");
        var etag = first.Headers.ETag!;

        var request = new HttpRequestMessage(HttpMethod.Get, "/v1/content/packs/exercises");
        request.Headers.IfNoneMatch.Add(new EntityTagHeaderValue(etag.Tag));
        var second = await user.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Equal("", await second.Content.ReadAsStringAsync());

        var stale = new HttpRequestMessage(HttpMethod.Get, "/v1/content/packs/exercises");
        stale.Headers.IfNoneMatch.Add(new EntityTagHeaderValue("\"old\""));
        Assert.Equal(HttpStatusCode.OK, (await user.Client.SendAsync(stale)).StatusCode);
    }

    [Fact]
    public async Task Myths_are_sliced_out_of_the_learn_file()
    {
        var user = await TestUser.SignInAsync(factory);
        var body = await user.Client.GetStringAsync("/v1/content/packs/myths");
        Assert.Contains("\"myths\"", body);
        Assert.DoesNotContain("\"concepts\"", body);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("foods")] // whitelisted but not deployed in the test folder
    [InlineData("secret.txt")]
    [InlineData("..%2Fsecret.txt")]
    [InlineData("%2e%2e%2fsecret.txt")]
    [InlineData("..%5Csecret.txt")]
    [InlineData("exercises.json")]
    public async Task Unknown_names_and_path_traversal_are_404_problem_json(string name)
    {
        var user = await TestUser.SignInAsync(factory);
        var res = await user.Client.GetAsync("/v1/content/packs/" + name);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.DoesNotContain("never served", body);
        if (body.Length > 0) Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
    }
}
