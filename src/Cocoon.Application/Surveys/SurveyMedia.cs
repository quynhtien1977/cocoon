using Cocoon.Domain.Enums;

namespace Cocoon.Application.Surveys;

/// <summary>Links and limits for the optional photos and videos of survey questions, shared by manager and customer views.</summary>
public static class SurveyMedia
{
    /// <summary>A question may have none; text-only surveys stay valid.</summary>
    public const int MaxPerQuestion = 6;
    /// <summary>AGENTS.md image rule: jpg/png/webp, at most 2 MB, checked by content.</summary>
    public const long MaxImageBytes = 2 * 1024 * 1024;
    /// <summary>Uploads kept per survey, referenced or not, so a draft cannot fill the bucket.</summary>
    public const int MaxImagesPerSurvey = 100;

    public static string ImageUrl(int imageId) => $"/api/v1/survey-media/{imageId}";
}

/// <summary>Url for an Image, YoutubeVideoId for a Video (embedded from youtube-nocookie.com).</summary>
public sealed record CustomerQuestionMedia(SurveyMediaKind Type, string? Url, string? YoutubeVideoId);
