using Cocoon.Domain.Enums;

namespace Cocoon.Application.Surveys;

public sealed record CustomerSurveyQuery(int Page = 1, int PageSize = 20, string? Search = null, string? Sort = null, string? Status = null);
public sealed record CustomerSurveyPage(IReadOnlyList<CustomerSurveyListItem> Items, int TotalCount, int Page, int PageSize);
public sealed record CustomerSurveyListItem(int Id, string Title, string Description, string Category, SurveyStatus Status,
    DateTime? OpenAt, DateTime? CloseAt, DateTime? CompletedAt, int QuestionCount, int EstimatedMinutes, string? GoogleFormUrl = null);
public sealed record CustomerSurveyDetails(int Id, string Title, string Description, SurveyStatus Status, DateTime? OpenAt,
    DateTime? CloseAt, DateTime? CompletedAt, IReadOnlyList<CustomerSurveyQuestion> Questions, IReadOnlyList<CustomerSurveyAnswerValue> Answers);
public sealed record CustomerSurveyQuestion(int Id, string Text, QuestionType Type, bool IsRequired, IReadOnlyList<CustomerSurveyOption> Options);
public sealed record CustomerSurveyOption(int Id, string Text);
public sealed record CustomerSurveyAnswerValue(int QuestionId, int[]? OptionIds, decimal? NumericValue, string? TextValue);
public sealed record CustomerSurveySubmitted(int Id, DateTime SubmittedAt);

/// <summary>Expected survey failures; the API translates these into ProblemDetails without exposing database errors.</summary>
public sealed class CustomerSurveyException(int status, string code, string message, string? field = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public string? Field { get; } = field;
}
