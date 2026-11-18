namespace Cocoon.Application.Storage;

/// <summary>Private blob storage (MinIO locally). Objects are never served directly; the API checks access first.</summary>
public interface IObjectStorage
{
    Task PutAsync(string key, Stream content, long size, string contentType, CancellationToken ct);

    /// <summary>Copies the object into <paramref name="destination"/>; false when it does not exist.</summary>
    Task<bool> CopyToAsync(string key, Stream destination, CancellationToken ct);

    Task DeleteAsync(string key, CancellationToken ct);
}
