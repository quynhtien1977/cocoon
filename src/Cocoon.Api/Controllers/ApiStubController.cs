using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>Contract-first base: routes and policies exist so OpenAPI is complete; bodies land per Jira task.</summary>
[ApiController]
public abstract class ApiStubController : ControllerBase
{
    protected ObjectResult NotImplementedYet() => Problem(statusCode: StatusCodes.Status501NotImplemented);

    /// <summary>ProblemDetails with a domain code (EMAIL_TAKEN...) instead of the generic one for the status.</summary>
    protected ObjectResult Fail(int status, string code, string detail)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, status, detail: detail);
        problem.Extensions["code"] = code;
        return new ObjectResult(problem) { StatusCode = status };
    }
}

public sealed record ListQuery(int Page = 1, int PageSize = 20, string? Search = null, string? Sort = null, string? Status = null);
