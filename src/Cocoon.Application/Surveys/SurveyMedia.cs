namespace Cocoon.Application.Surveys;

/// <summary>Links to a survey's cover photo, shared by the manager and customer survey details.</summary>
public static class SurveyMedia
{
    /// <summary>The key's file name changes with every upload, so a replaced photo is never served from cache.</summary>
    public static string? ImageUrl(int surveyId, string? objectKey) => objectKey is null
        ? null : $"/api/v1/survey-images/{surveyId}?v={Path.GetFileNameWithoutExtension(objectKey)}";
}
