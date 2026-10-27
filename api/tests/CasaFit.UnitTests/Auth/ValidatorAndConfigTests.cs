using CasaFit.Application.Auth;
using CasaFit.Infrastructure.Persistence;

namespace CasaFit.UnitTests.Auth;

public class ValidatorAndConfigTests
{
    [Theory]
    [InlineData("9876543210", null, true)]
    [InlineData(null, "asha@example.com", true)]
    [InlineData("9876543210", "asha@example.com", false)]
    [InlineData(null, null, false)]
    [InlineData("12", null, false)]
    [InlineData(null, "x@mailinator.com", false)]
    public void SendCode_requires_exactly_one_valid_identifier(string? phone, string? email, bool valid)
    {
        var result = new SendCodeRequestValidator().Validate(new SendCodeRequest { Phone = phone, Email = email });
        Assert.Equal(valid, result.IsValid);
    }

    [Theory]
    [InlineData("123456", true)]
    [InlineData("12345", false)]
    [InlineData("1234567", false)]
    [InlineData("12345a", false)]
    [InlineData("", false)]
    public void Verify_requires_a_six_digit_code(string code, bool valid)
    {
        var result = new VerifyCodeRequestValidator().Validate(new VerifyCodeRequest { Phone = "9876543210", Code = code });
        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public void Postgres_url_converts_to_npgsql_connection_string()
    {
        var cs = ConnectionStringConverter.ToNpgsql("postgresql://u:p%40ss@db.example.com:6543/casafit?sslmode=require");
        Assert.Equal("Host=db.example.com;Port=6543;Database=casafit;Username=u;Password=p@ss;SSL Mode=require", cs);
    }

    [Fact]
    public void Key_value_connection_string_passes_through()
    {
        const string raw = "Host=localhost;Database=x";
        Assert.Equal(raw, ConnectionStringConverter.ToNpgsql(raw));
    }
}
