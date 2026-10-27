using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace CasaFit.Api.Common;

/// <summary>Declares the JWT bearer scheme in openapi.json so generated clients know how to authenticate.</summary>
public sealed class BearerSecurityTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken ct)
    {
        document.Info.Title = "CasaFit API";
        document.Info.Version = "0.1";
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
        };
        return Task.CompletedTask;
    }
}
