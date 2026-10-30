using CasaFit.Application.Content;
using CasaFit.Application.Entitlements;
using Microsoft.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc;

namespace CasaFit.Api.Content;

[ApiController]
[Produces("application/json")]
[Route("v1/content")]
public sealed class ContentController(ContentService content) : ControllerBase
{
    /// <summary>Current content pack versions (stub).</summary>
    [HttpGet("version")]
    [ProducesResponseType<ContentVersionResponse>(StatusCodes.Status200OK)]
    public ContentVersionResponse Version() => content.GetVersion();

    /// <summary>
    /// A versioned content pack: exercises, plans, foods, myths or concepts. Send If-None-Match with the last ETag
    /// to get 304 when nothing changed.
    /// </summary>
    [HttpGet("packs/{name}")]
    [Produces("application/json")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Pack(string name, CancellationToken ct)
    {
        var pack = await content.GetPackAsync(name, ct);
        Response.Headers.CacheControl = "private, max-age=3600, must-revalidate";
        // FileContentResult answers If-None-Match with 304 and sets ETag and Last-Modified.
        return File(pack.Body, "application/json", pack.LastModified, new EntityTagHeaderValue(pack.ETag));
    }
}
