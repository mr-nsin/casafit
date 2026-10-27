using FluentValidation;

namespace CasaFit.Application.Entitlements;

internal static class KeyRules
{
    public const string Pattern = @"^[A-Za-z0-9_:.\-]{16,128}$";
    public const string Message = "Idempotency key must be 16 to 128 characters: letters, digits and _ : . -";
}

public sealed class ConsumeRequestValidator : AbstractValidator<ConsumeRequest>
{
    public static readonly string[] Exercises = ["squat", "push_up", "plank", "lunge"];

    public ConsumeRequestValidator()
    {
        RuleFor(x => x.IdempotencyKey).Matches(KeyRules.Pattern).WithMessage(KeyRules.Message);
        RuleFor(x => x.Exercise).Must(e => Exercises.Contains(e)).WithMessage("Exercise must be squat, push_up, plank or lunge.");
    }
}

public sealed class RefundRequestValidator : AbstractValidator<RefundRequest>
{
    public RefundRequestValidator()
    {
        RuleFor(x => x.IdempotencyKey).Matches(KeyRules.Pattern).WithMessage(KeyRules.Message);
        RuleFor(x => x.ConsumeIdempotencyKey).Matches(KeyRules.Pattern).WithMessage(KeyRules.Message);
        RuleFor(x => x.RepsCompleted).InclusiveBetween(0, 1000);
    }
}

public sealed class RevenueCatWebhookRequestValidator : AbstractValidator<RevenueCatWebhookRequest>
{
    public RevenueCatWebhookRequestValidator()
    {
        RuleFor(x => x.Event).NotNull().WithMessage("Event is required.");
        When(x => x.Event is not null, () =>
        {
            RuleFor(x => x.Event!.Id).NotEmpty().MaximumLength(128);
            RuleFor(x => x.Event!.Type).NotEmpty().MaximumLength(64);
            RuleFor(x => x.Event!.AppUserId).NotEmpty().MaximumLength(256);
        });
    }
}
