using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

/// <summary>Contract-first base: routes and policies exist so OpenAPI is complete; bodies land per Jira task.</summary>
[ApiController]
public abstract class ApiStubController : ControllerBase
{
    protected ObjectResult NotImplementedYet() => Problem(statusCode: StatusCodes.Status501NotImplemented);
}

public sealed record ListQuery(int Page = 1, int PageSize = 20, string? Search = null, string? Sort = null, string? Status = null);
