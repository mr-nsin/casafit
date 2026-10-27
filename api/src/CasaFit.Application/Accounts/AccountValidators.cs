using FluentValidation;

namespace CasaFit.Application.Accounts;

public static class SyncLimits
{
    public const int MaxEntries = 200;
}

public sealed class UpsertPlanRequestValidator : AbstractValidator<UpsertPlanRequest>
{
    public static readonly string[] Goals = ["stay_fit", "body_part", "gentler"];
    public static readonly string[] Experiences = ["new", "on_and_off", "regular"];

    public UpsertPlanRequestValidator()
    {
        RuleFor(x => x.Unknown)
            .Must(u => u is null || u.Count == 0)
            .WithMessage("Only goal, styles, days, experience and variant are accepted. Health answers and pain areas stay on the phone.");
        RuleFor(x => x.Goal).Must(g => Goals.Contains(g)).WithMessage("Goal must be stay_fit, body_part or gentler.");
        RuleFor(x => x.Styles).InclusiveBetween(1, 7).WithMessage("Styles is a bitmask of 1 (normal), 2 (yoga) and 4 (dance).");
        RuleFor(x => x.Days).InclusiveBetween(3, 7).WithMessage("Days must be 3 to 7.");
        RuleFor(x => x.Experience).Must(e => Experiences.Contains(e)).WithMessage("Experience must be new, on_and_off or regular.");
        RuleFor(x => x.Variant).Matches(@"^[a-z0-9_]{1,32}$").WithMessage("Variant must be 1 to 32 characters: a-z, 0-9 and underscore.");
    }
}

public sealed class RecordConsentRequestValidator : AbstractValidator<RecordConsentRequest>
{
    public static readonly string[] Types = ["health_sync", "analytics", "privacy_notice", "terms"];

    public RecordConsentRequestValidator()
    {
        RuleFor(x => x.Type).Must(t => Types.Contains(t)).WithMessage("Unknown consent type.");
        RuleFor(x => x.PolicyVersion).Matches(@"^[A-Za-z0-9._-]{1,32}$").WithMessage("Policy version is not valid.");
    }
}

public sealed class SyncStepsRequestValidator : AbstractValidator<SyncStepsRequest>
{
    public SyncStepsRequestValidator()
    {
        RuleFor(x => x.Entries).NotEmpty().Must(e => e.Count <= SyncLimits.MaxEntries)
            .WithMessage("Send 1 to 200 entries.");
        RuleForEach(x => x.Entries).ChildRules(e =>
        {
            e.RuleFor(x => x.Date).Must(d => d != default).WithMessage("Date is required.");
            e.RuleFor(x => x.Steps).InclusiveBetween(0, 200_000);
            e.RuleFor(x => x.BriskMinutes).InclusiveBetween(0, 1440);
        });
    }
}

public sealed class SyncSessionsRequestValidator : AbstractValidator<SyncSessionsRequest>
{
    public static readonly string[] Styles = ["normal", "yoga", "dance"];
    public static readonly string[] Felt = ["easy", "about_right", "hard"];

    public SyncSessionsRequestValidator()
    {
        RuleFor(x => x.Entries).NotEmpty().Must(e => e.Count <= SyncLimits.MaxEntries)
            .WithMessage("Send 1 to 200 entries.");
        RuleForEach(x => x.Entries).ChildRules(e =>
        {
            e.RuleFor(x => x.Id).NotEmpty();
            e.RuleFor(x => x.PlanWeek).InclusiveBetween(1, 1000);
            e.RuleFor(x => x.PlanDay).InclusiveBetween(1, 7);
            e.RuleFor(x => x.Style).Must(s => Styles.Contains(s)).WithMessage("Style must be normal, yoga or dance.");
            e.RuleFor(x => x.Felt).Must(f => Felt.Contains(f)).WithMessage("Felt must be easy, about_right or hard.");
            e.RuleFor(x => x.CompletedAt).Must(d => d != default).WithMessage("CompletedAt is required.");
            // DurationS has no range rule on purpose: out-of-range values are clamped to 60..3600, not rejected.
        });
    }
}

public sealed class SyncFoodRequestValidator : AbstractValidator<SyncFoodRequest>
{
    public static readonly string[] Meals = ["breakfast", "lunch", "snack", "dinner", "other"];

    public SyncFoodRequestValidator()
    {
        RuleFor(x => x.Entries).NotEmpty().Must(e => e.Count <= SyncLimits.MaxEntries)
            .WithMessage("Send 1 to 200 entries.");
        RuleForEach(x => x.Entries).ChildRules(e =>
        {
            e.RuleFor(x => x.Id).NotEmpty();
            e.RuleFor(x => x.LoggedOn).Must(d => d != default).WithMessage("LoggedOn is required.");
            e.RuleFor(x => x.Meal).Must(m => Meals.Contains(m)).WithMessage("Meal must be breakfast, lunch, snack, dinner or other.");
            e.RuleFor(x => x.FoodId).Matches(@"^[a-z0-9_]{1,64}$").WithMessage("FoodId is not valid.");
            e.RuleFor(x => x.Portions).InclusiveBetween(0.01m, 99.99m).PrecisionScale(5, 2, false);
        });
    }
}
