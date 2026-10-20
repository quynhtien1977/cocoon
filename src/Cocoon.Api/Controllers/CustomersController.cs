using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cocoon.Api.Controllers;

[Route("api/v1/customers")]
[Authorize(Policy = "RequireManager")]
public sealed class CustomersController : ApiStubController
{
    [HttpGet] public IActionResult List([FromQuery] ListQuery query) => NotImplementedYet();
    [HttpPost] public IActionResult Create(CreateCustomerRequest request) => NotImplementedYet();
    [HttpGet("{id:int}")] public IActionResult Get(int id) => NotImplementedYet();
    [HttpPost("{id:int}/lock")] public IActionResult Lock(int id) => NotImplementedYet();
    [HttpPost("{id:int}/unlock")] public IActionResult Unlock(int id) => NotImplementedYet();
    [HttpDelete("{id:int}")] public IActionResult Delete(int id) => NotImplementedYet();
    [HttpGet("{id:int}/orders")] public IActionResult Orders(int id) => NotImplementedYet();
    [HttpGet("{id:int}/feedback")] public IActionResult Feedback(int id) => NotImplementedYet();
    [HttpGet("{id:int}/surveys")] public IActionResult Surveys(int id) => NotImplementedYet();
    [HttpGet("{id:int}/recommendations")] public IActionResult Recommendations(int id) => NotImplementedYet();
}

public sealed record CreateCustomerRequest(string Email, string FullName, string? Phone, DateOnly? DateOfBirth,
    string? Gender, string? Address);
