using Cocoon.Application.Accounts;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Configuration;

public sealed class AccountExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not AccountOperationException error) return false;
        ProblemDetails problem = error.Field is null ? new ProblemDetails() : new ValidationProblemDetails(
            new Dictionary<string, string[]> { [error.Field] = [error.Message] });
        problem.Status = error.Status;
        problem.Detail = error.Message;
        ApiProblems.Customize(problem, error.Status);
        problem.Extensions["code"] = error.Code;
        context.Response.StatusCode = error.Status;
        await problems.WriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem });
        return true;
    }
}
