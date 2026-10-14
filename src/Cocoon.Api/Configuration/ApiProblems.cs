using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Configuration;

public static class ApiProblems
{
    public static void Customize(ProblemDetails problem, int status)
    {
        var (code, title) = status switch
        {
            400 => ("VALIDATION_ERROR", "Dữ liệu không hợp lệ."),
            401 => ("UNAUTHENTICATED", "Vui lòng đăng nhập để tiếp tục."),
            403 => ("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."),
            404 => ("NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu."),
            409 => ("CONFLICT", "Dữ liệu đang có xung đột."),
            429 => ("RATE_LIMITED", "Bạn thao tác quá nhanh. Vui lòng thử lại sau."),
            _ => ("SERVER_ERROR", "Hệ thống gặp lỗi. Vui lòng thử lại sau.")
        };
        problem.Title = title;
        problem.Extensions.TryAdd("code", code);
        if (status >= 500) problem.Detail = null;
    }
}
