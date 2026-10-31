using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Cocoon.Api.Auth;

public sealed class MustChangePasswordFilter : IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var http = context.HttpContext;
        if (http.Items[nameof(Domain.Entities.Account.MustChangePassword)] is not true) return;
        var allowed = http.Request.Method == "GET" && http.Request.Path == "/api/v1/me"
            || http.Request.Method == "POST" && (http.Request.Path == "/api/v1/auth/change-password"
                || http.Request.Path == "/api/v1/auth/logout" || http.Request.Path == "/api/v1/auth/refresh");
        if (allowed) return;
        var problem = new ProblemDetails { Status = 403, Detail = "Bạn cần đổi mật khẩu tạm trước khi sử dụng chức năng này." };
        Configuration.ApiProblems.Customize(problem, 403);
        problem.Extensions["code"] = "PASSWORD_CHANGE_REQUIRED";
        context.Result = new ObjectResult(problem) { StatusCode = 403, ContentTypes = { "application/problem+json" } };
    }
}
