using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[ApiController]
[Route("api/v1/health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public ActionResult<HealthResponse> Get() => Ok(new HealthResponse("ok"));
}

public sealed record HealthResponse(string Status);
