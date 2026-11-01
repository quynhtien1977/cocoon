using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Api.Controllers;

/// <summary>Contract-first base: routes and policies exist so OpenAPI is complete; bodies land per Jira task.</summary>
[ApiController]
public abstract class ApiStubController : ControllerBase
{
    protected ObjectResult NotImplementedYet() => Problem(statusCode: StatusCodes.Status501NotImplemented);

    protected int AccountId => int.Parse(User.FindFirst("sub")!.Value);

    protected static async Task<PagedResult<T>> ToPageAsync<T>(IQueryable<T> source, ListQuery query, CancellationToken cancellationToken)
    {
        var (page, pageSize) = (Math.Max(query.Page, 1), Math.Clamp(query.PageSize, 1, 100));
        var total = await source.CountAsync(cancellationToken);
        var items = await source.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<T>(items, total, page, pageSize);
    }

    /// <summary>ProblemDetails with a domain code (EMAIL_TAKEN...) instead of the generic one for the status.</summary>
    protected ObjectResult Fail(int status, string code, string detail)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, status, detail: detail);
        problem.Extensions["code"] = code;
        return new ObjectResult(problem) { StatusCode = status };
    }
}

public sealed record ListQuery(int Page = 1, int PageSize = 20, string? Search = null, string? Sort = null, string? Status = null);
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
