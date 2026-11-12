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

/// <summary>
/// Issues the access JWT and the rotating refresh token, both as HttpOnly cookies. The refresh cookie is sent site-wide
/// so the Next.js proxy can renew an expired access token when a page loads (as Supabase SSR does), not only API calls.
/// </summary>
public sealed class TokenService(AppDbContext db, IOptions<JwtOptions> jwt)
{
    public const string AccessCookie = "access_token";
    public const string RefreshCookie = "refresh_token";
    private const string RefreshPath = "/";
    /// <summary>Path used before 13/11/2026; its cookie is deleted so two refresh cookies never compete.</summary>
    private const string LegacyRefreshPath = "/api/v1/auth";
    private static readonly TimeSpan AccessLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(7);
    /// <summary>
    /// A token rotated this recently is still accepted, because parallel page prefetches or a second tab can present it
    /// before the new cookie arrives (Auth0 "rotation overlap period", Supabase "reuse interval" of 10 s). Replays after
    /// this window are treated as theft. Logout and forced revocation also expire the token, so they get no overlap.
    /// </summary>
    public static readonly TimeSpan RotationOverlap = TimeSpan.FromSeconds(10);

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
        response.Cookies.Delete(RefreshCookie, Cookie(LegacyRefreshPath, now, secure));
    }

    /// <summary>
    /// Returns the token row the cookie may still use, or null. Expired rows (natural expiry, logout, forced revocation)
    /// are simply refused. A row rotated within <see cref="RotationOverlap"/> is returned so a concurrent request succeeds;
    /// replaying a rotated row later means it was copied, so every session of the account is revoked.
    /// </summary>
    public async Task<RefreshToken?> FindActiveAsync(string? value, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var hash = Hash(value);
        var token = await db.Set<RefreshToken>().SingleOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        var now = DateTime.UtcNow;
        if (token is null || token.ExpiresAt <= now) return null;
        if (token.RevokedAt is { } rotated && rotated <= now - RotationOverlap)
        {
            await RevokeAllAsync(token.AccountId, cancellationToken);
            return null;
        }
        return token;
    }

    /// <summary>Ends every session of the account at once, with no rotation overlap (logout everywhere, theft, account change).</summary>
    public Task<int> RevokeAllAsync(int accountId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return db.Set<RefreshToken>().Where(t => t.AccountId == accountId && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, t => t.RevokedAt ?? now).SetProperty(t => t.ExpiresAt, now), cancellationToken);
    }

    /// <summary>Ends one session now: unlike rotation, a logged-out token gets no overlap window.</summary>
    public static void Expire(RefreshToken token)
    {
        var now = DateTime.UtcNow;
        token.RevokedAt ??= now;
        token.ExpiresAt = now;
    }

    public static void SignOut(HttpResponse response)
    {
        // Deletions carry the same attributes as the cookies they replace, so browsers match and drop them.
        var (now, secure) = (DateTime.UtcNow, response.HttpContext.Request.IsHttps);
        response.Cookies.Delete(AccessCookie, Cookie("/", now, secure));
        response.Cookies.Delete(RefreshCookie, Cookie(RefreshPath, now, secure));
        response.Cookies.Delete(RefreshCookie, Cookie(LegacyRefreshPath, now, secure));
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static CookieOptions Cookie(string path, DateTime expires, bool secure) =>
        new() { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Lax, Path = path, Expires = expires };
}
