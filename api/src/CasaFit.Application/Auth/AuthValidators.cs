using FluentValidation;

namespace CasaFit.Application.Auth;

internal static class IdentifierRules
{
    public static void ExactlyOne<T>(AbstractValidator<T> v, Func<T, string?> phone, Func<T, string?> email)
    {
        v.RuleFor(x => x)
            .Must(x => string.IsNullOrWhiteSpace(phone(x)) != string.IsNullOrWhiteSpace(email(x)))
            .WithName("identifier")
            .WithMessage("Provide exactly one of phone or email.");

        v.RuleFor(x => phone(x)).Must(p => IdentifierNormaliser.TryNormalisePhone(p, out _))
            .When(x => !string.IsNullOrWhiteSpace(phone(x)))
            .WithName("phone")
            .WithMessage("Phone number must be 10 digits or in E.164 format, for example +919876543210.");

        v.RuleFor(x => email(x)).Must(e => IdentifierNormaliser.TryNormaliseEmail(e, out _))
            .When(x => !string.IsNullOrWhiteSpace(email(x)))
            .WithName("email")
            .WithMessage("Email address is not valid or not accepted.");
    }
}

public sealed class SendCodeRequestValidator : AbstractValidator<SendCodeRequest>
{
    public SendCodeRequestValidator() => IdentifierRules.ExactlyOne(this, x => x.Phone, x => x.Email);
}

public sealed class VerifyCodeRequestValidator : AbstractValidator<VerifyCodeRequest>
{
    public VerifyCodeRequestValidator()
    {
        IdentifierRules.ExactlyOne(this, x => x.Phone, x => x.Email);
        RuleFor(x => x.Code).Matches(@"^\d{6}$").WithMessage("Code must be 6 digits.");
    }
}

public sealed class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator() => RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(4096);
}
