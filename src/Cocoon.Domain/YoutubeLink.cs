using System.Text.RegularExpressions;

namespace Cocoon.Domain;

/// <summary>Reads the video id from the YouTube links people paste; anything else is rejected, never embedded.</summary>
public static partial class YoutubeLink
{
    [GeneratedRegex("^[A-Za-z0-9_-]{11}$")]
    private static partial Regex IdPattern();

    private static readonly string[] Hosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];

    /// <summary>
    /// watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID (http or https, extra query ignored) or a bare id.
    /// Returns null for any other text.
    /// </summary>
    public static string? VideoId(string? value)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > 500) return null;
        if (IdPattern().IsMatch(text)) return text;
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http")
            || !string.IsNullOrEmpty(uri.UserInfo)) return null;
        var host = uri.Host.ToLowerInvariant();
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        string? id = null;
        if (host == "youtu.be")
            id = segments.Length == 1 ? segments[0] : null;
        else if (Hosts.Contains(host))
            id = segments switch
            {
                ["watch"] => Query(uri.Query, "v"),
                ["shorts" or "embed" or "live", var part] => part,
                _ => null,
            };
        return id is not null && IdPattern().IsMatch(id) ? id : null;
    }

    public static string WatchUrl(string id) => $"https://www.youtube.com/watch?v={id}";

    private static string? Query(string query, string name)
    {
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2 && parts[0] == name) return Uri.UnescapeDataString(parts[1]);
        }
        return null;
    }
}
