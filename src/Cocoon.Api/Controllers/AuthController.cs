using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/auth")]
[AllowAnonymous]
public sealed class AuthController : ApiStubController
{
    [HttpPost("register")] public IActionResult Register(RegisterRequest request) => NotImplementedYet();
    [HttpPost("login")] public IActionResult Login(LoginRequest request) => NotImplementedYet();
    [HttpPost("refresh")] public IActionResult Refresh() => NotImplementedYet();
    [HttpPost("logout")] public IActionResult Logout() => NotImplementedYet();
}

[Route("api/v1")]
public sealed class ProfileController : ApiStubController
{
    [HttpGet("me")] public IActionResult GetMe() => NotImplementedYet();
    [HttpPut("me")] public IActionResult UpdateMe(UpdateProfileRequest request) => NotImplementedYet();
    [HttpGet("preferences")] public IActionResult ListPreferences() => NotImplementedYet();

    [HttpGet("me/preferences"), Authorize(Policy = "RequireCustomer")]
    public IActionResult GetMyPreferences() => NotImplementedYet();

    [HttpPut("me/preferences"), Authorize(Policy = "RequireCustomer")]
    public IActionResult UpdateMyPreferences(PreferenceIdsRequest request) => NotImplementedYet();
}

public sealed record RegisterRequest(string Email, string Password, string FullName, string? Phone,
    DateOnly? DateOfBirth, string? Gender, int[] PreferenceIds);
public sealed record LoginRequest(string Email, string Password);
public sealed record UpdateProfileRequest(string FullName, string? Phone, DateOnly? DateOfBirth, string? Gender,
    string? Address, bool ConsentPersonalData);
public sealed record PreferenceIdsRequest(int[] PreferenceIds);
