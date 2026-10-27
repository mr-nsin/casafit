using CasaFit.Application.Content;
using CasaFit.Application.Entitlements;
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
}
