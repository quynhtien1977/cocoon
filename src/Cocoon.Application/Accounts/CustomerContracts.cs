using System.ComponentModel.DataAnnotations;
using Cocoon.Domain.Enums;

namespace Cocoon.Application.Accounts;

public sealed record CustomerQuery(int Page = 1, int PageSize = 20, string? Search = null, string? Status = null,
    string? Gender = null, int? AgeMin = null, int? AgeMax = null, int? PreferenceId = null, string? Sort = null, string? Order = null);

public sealed record CustomerInput(
    [Required, StringLength(200, MinimumLength = 2)] string FullName,
    [StringLength(32)] string? Phone = null, DateOnly? DateOfBirth = null,
    string? Gender = null, [StringLength(1000)] string? Address = null,
    bool ConsentPersonalData = false, int[]? PreferenceIds = null);

public record CustomerRow(int Id, string Code, string FullName, string Email, string? Phone, int? Age, string? Gender,
    string[] Preferences, int OrderCount, DateTime? LastOrderAt, DateTime JoinedAt, string Status);

public sealed record CustomerDetails : CustomerRow
{
    public CustomerDetails(CustomerRow row) : base(row) { }
    public DateOnly? DateOfBirth { get; init; }
    public string? Address { get; init; }
    public bool ConsentPersonalData { get; init; }
    public int[] PreferenceIds { get; init; } = [];
    public decimal TotalSpent { get; init; }
}

public sealed record CustomerPage<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
public sealed record CustomerOrderRow(int Id, string Code, DateTime PlacedAt, int ItemCount, decimal Total, OrderStatus Status);
public sealed record CustomerFeedbackRow(int Id, string ProductName, int Rating, string Content, DateTime CreatedAt, FeedbackStatus Status);
public sealed record CustomerSurveyRow(int Id, string Title, DateTime SentAt, RecipientStatus Status, DateTime? SubmittedAt);
