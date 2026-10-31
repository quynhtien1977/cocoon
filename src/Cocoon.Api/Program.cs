using System.Text;
using System.Text.Json.Serialization;
using Cocoon.Api.Auth;
using Cocoon.Api.Configuration;
using Cocoon.Api.Seeding;
using Cocoon.Application.Accounts;
using Cocoon.Infrastructure.Accounts;
using Cocoon.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Cocoon.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Formatting.Compact;

var seedRequested = args is ["seed"];
var builder = WebApplication.CreateBuilder(seedRequested ? [] : args);
if (seedRequested)
{
    Environment.ExitCode = await LocalSeedCommand.RunAsync(builder.Environment, builder.Configuration);
    return;
}
builder.Services.AddSerilog(config => config
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(new RenderedCompactJsonFormatter()));
builder.Services.AddControllers(options => { options.Filters.Add(new AuthorizeFilter()); options.Filters.Add<MustChangePasswordFilter>(); })
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = context =>
    {
        var problem = new ValidationProblemDetails(context.ModelState) { Status = 400 };
        ApiProblems.Customize(problem, 400);
        return new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
    });
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddExceptionHandler<AccountExceptionHandler>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAccountPasswords, AccountPasswords>();
builder.Services.AddScoped<AccountManagementService>();
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    // Controller Problem(statusCode: x) sets Status before the response status is written.
    ApiProblems.Customize(context.ProblemDetails, context.ProblemDetails.Status ?? context.HttpContext.Response.StatusCode));
builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(
    builder.Configuration.GetConnectionString("Default")));
builder.Services.AddCors(options => options.AddPolicy("Web", policy => policy
    .WithOrigins(builder.Configuration["Web:Origin"] ?? "http://localhost:3000")
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddOptions<JwtOptions>().BindConfiguration("Jwt")
    .Validate(options => Encoding.UTF8.GetByteCount(options.Key) >= 32
        && !options.Key.StartsWith("replace_", StringComparison.Ordinal), "Jwt:Key phải là khóa ngẫu nhiên ít nhất 32 byte.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.Issuer) && !string.IsNullOrWhiteSpace(options.Audience),
        "Thiếu Jwt:Issuer hoặc Jwt:Audience.")
    .ValidateOnStart();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwt) =>
    {
        options.MapInboundClaims = false;
        options.IncludeErrorDetails = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidIssuer = jwt.Value.Issuer,
            ValidateAudience = true, ValidAudience = jwt.Value.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.Key)),
            ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = "role", NameClaimType = "sub",
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (!context.Request.Headers.ContainsKey("Authorization"))
                    context.Token = context.Request.Cookies[TokenService.AccessCookie];
                return Task.CompletedTask;
            },
            // A valid signature is not enough: locked, disabled, deleted or re-roled accounts lose access immediately.
            OnTokenValidated = async context =>
            {
                var gate = context.HttpContext.RequestServices.GetRequiredService<IAccountGate>();
                var role = context.Principal?.FindFirst("role")?.Value;
                if (!int.TryParse(context.Principal?.FindFirst("sub")?.Value, out var id) || role is null
                    || !await gate.IsAllowedAsync(id, role, context.HttpContext.RequestAborted))
                    context.Fail("Tài khoản không còn quyền truy cập.");
            }
        };
    });
builder.Services.AddScoped<IAccountGate, DbAccountGate>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddSingleton<IPasswordHasher<Account>, PasswordHasher<Account>>();
builder.Services.AddAuthorization(options =>
{
    foreach (var role in new[] { "Customer", "Staff", "Manager", "Admin" })
        options.AddPolicy($"Require{role}", policy => policy.RequireAuthenticatedUser().RequireRole(role));
});
var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseCors("Web");
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi("/swagger/{documentName}/swagger.json");
    app.MapScalarApiReference("/swagger", options => options
        .WithTitle("Cocoon CRM API")
        .WithOpenApiRoutePattern("/swagger/{documentName}/swagger.json"));
}
app.MapControllers();
app.Run();

public partial class Program;
