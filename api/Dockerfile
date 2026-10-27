# Build context is the api/ folder:  docker build -t casafit-api api/
# Multi-stage: SDK image builds, the small ASP.NET runtime image runs.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, so this layer is cached until a csproj or package version changes.
COPY Directory.Build.props Directory.Packages.props ./
COPY src/CasaFit.Domain/CasaFit.Domain.csproj src/CasaFit.Domain/
COPY src/CasaFit.Application/CasaFit.Application.csproj src/CasaFit.Application/
COPY src/CasaFit.Infrastructure/CasaFit.Infrastructure.csproj src/CasaFit.Infrastructure/
COPY src/CasaFit.Api/CasaFit.Api.csproj src/CasaFit.Api/
RUN dotnet restore src/CasaFit.Api/CasaFit.Api.csproj

COPY src/ src/
# The OpenAPI document is generated on the dev machine and committed; skip it in the image build.
RUN dotnet publish src/CasaFit.Api/CasaFit.Api.csproj -c Release -o /app --no-restore \
    -p:OpenApiGenerateDocuments=false -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Non-root. The aspnet image ships an "app" user.
USER app

# Hosts that set PORT (Railway, Cloud Run) are honoured in Program.cs.
# Without PORT the image listens on 8080, the .NET container default.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "CasaFit.Api.dll"]
