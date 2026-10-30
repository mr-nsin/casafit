# Build context is the REPO ROOT (the content packs live in app/assets/content):
#   docker build -f api/Dockerfile -t casafit-api .
# Multi-stage: SDK image builds, the small ASP.NET runtime image runs.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, so this layer is cached until a csproj or package version changes.
COPY api/Directory.Build.props api/Directory.Packages.props ./
COPY api/src/CasaFit.Domain/CasaFit.Domain.csproj src/CasaFit.Domain/
COPY api/src/CasaFit.Application/CasaFit.Application.csproj src/CasaFit.Application/
COPY api/src/CasaFit.Infrastructure/CasaFit.Infrastructure.csproj src/CasaFit.Infrastructure/
COPY api/src/CasaFit.Api/CasaFit.Api.csproj src/CasaFit.Api/
RUN dotnet restore src/CasaFit.Api/CasaFit.Api.csproj

COPY api/src/ src/
# The OpenAPI document is generated on the dev machine and committed; skip it in the image build.
RUN dotnet publish src/CasaFit.Api/CasaFit.Api.csproj -c Release -o /app --no-restore \
    -p:OpenApiGenerateDocuments=false -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Content packs come from the app's asset folder at build time, so they are not duplicated in git.
COPY app/assets/content/exercises.json app/assets/content/plans.json app/assets/content/foods.json      app/assets/content/learn.json app/assets/content/manifest.json /app/content/
ENV Content__Directory=/app/content

# Non-root. The aspnet image ships an "app" user.
USER app

# Hosts that set PORT (Railway, Cloud Run) are honoured in Program.cs.
# Without PORT the image listens on 8080, the .NET container default.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "CasaFit.Api.dll"]
