using Cocoon.Application.Storage;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace Cocoon.Infrastructure.Storage;

public sealed class StorageOptions
{
    public string Endpoint { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string Bucket { get; set; } = "cocoon-feedback";
    public bool UseSsl { get; set; }
}

public sealed class MinioObjectStorage(IOptions<StorageOptions> options) : IObjectStorage
{
    private readonly IMinioClient _client = new MinioClient()
        .WithEndpoint(options.Value.Endpoint).WithCredentials(options.Value.AccessKey, options.Value.SecretKey)
        .WithSSL(options.Value.UseSsl).Build();
    private readonly string _bucket = options.Value.Bucket;
    // One check per process: the bucket is created on first upload instead of by a separate init container.
    private static readonly SemaphoreSlim BucketGate = new(1, 1);
    private static volatile bool _bucketReady;

    public async Task PutAsync(string key, Stream content, long size, string contentType, CancellationToken ct)
    {
        await EnsureBucketAsync(ct);
        await _client.PutObjectAsync(new PutObjectArgs().WithBucket(_bucket).WithObject(key)
            .WithStreamData(content).WithObjectSize(size).WithContentType(contentType), ct);
    }

    public async Task<bool> CopyToAsync(string key, Stream destination, CancellationToken ct)
    {
        try
        {
            await _client.GetObjectAsync(new GetObjectArgs().WithBucket(_bucket).WithObject(key)
                .WithCallbackStream(async (stream, token) => await stream.CopyToAsync(destination, token)), ct);
            return true;
        }
        catch (Exception e) when (e is ObjectNotFoundException or BucketNotFoundException)
        {
            return false;
        }
    }

    public Task DeleteAsync(string key, CancellationToken ct) =>
        _client.RemoveObjectAsync(new RemoveObjectArgs().WithBucket(_bucket).WithObject(key), ct);

    private async Task EnsureBucketAsync(CancellationToken ct)
    {
        if (_bucketReady) return;
        await BucketGate.WaitAsync(ct);
        try
        {
            if (!await _client.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucket), ct))
                await _client.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucket), ct);
            _bucketReady = true;
        }
        finally { BucketGate.Release(); }
    }
}
