using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Cocoon.Api.Configuration;
using Cocoon.Domain.Entities;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Cocoon.Api.Auth;

/// <summary>Issues the access JWT and the rotating refresh token, both as HttpOnly cookies.</summary>
public sealed class TokenService(AppDbContext db, IOptions<JwtOptions> jwt)
{
    public const string AccessCookie = "access_token";
    public const string RefreshCookie = "refresh_token";
    private const string RefreshPath = "/api/v1/auth";
    private static readonly TimeSpan AccessLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(7);

    /// <summary>Adds a refresh token row to the change tracker and writes both cookies; the caller saves.</summary>
    public void SignIn(HttpResponse response, Account account)
    {
        var now = DateTime.UtcNow;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.Key));
        var access = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(jwt.Value.Issuer, jwt.Value.Audience,
            [new Claim("sub", account.Id.ToString()), new Claim("role", account.Role.ToString())],
            notBefore: now, expires: now + AccessLifetime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)));
        var refresh = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        db.Add(new RefreshToken { AccountId = account.Id, TokenHash = Hash(refresh), ExpiresAt = now + RefreshLifetime });

        var secure = response.HttpContext.Request.IsHttps;
        response.Cookies.Append(AccessCookie, access, Cookie("/", now + AccessLifetime, secure));
        response.Cookies.Append(RefreshCookie, refresh, Cookie(RefreshPath, now + RefreshLifetime, secure));
    }

    /// <summary>Returns the live token row for the cookie value, or null. Replaying a revoked token revokes every session of that account.</summary>
    public async Task<RefreshToken?> FindActiveAsync(string? value, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var hash = Hash(value);
        var token = await db.Set<RefreshToken>().SingleOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (token is null) return null;
        if (token.RevokedAt is not null)
        {
            await RevokeAllAsync(token.AccountId, cancellationToken);
            return null;
        }
        return token.ExpiresAt > DateTime.UtcNow ? token : null;
    }

    public async Task RevokeAllAsync(int accountId, CancellationToken cancellationToken) =>
        await db.Set<RefreshToken>().Where(t => t.AccountId == accountId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), cancellationToken);

    public static void SignOut(HttpResponse response)
    {
        response.Cookies.Delete(AccessCookie, new CookieOptions { Path = "/" });
        response.Cookies.Delete(RefreshCookie, new CookieOptions { Path = RefreshPath });
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static CookieOptions Cookie(string path, DateTime expires, bool secure) =>
        new() { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Lax, Path = path, Expires = expires };
}
