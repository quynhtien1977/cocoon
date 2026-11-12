using Cocoon.Infrastructure.Feedbacks;
using Cocoon.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace Cocoon.Api.Feedbacks;

/// <summary>Runs the auto-close sweep on a timer. Failures are logged and retried next round, so a database that is not
/// migrated yet cannot stop the API.</summary>
public sealed class FeedbackAutoCloseWorker(IServiceScopeFactory scopes, IOptions<FeedbackOptions> options, ILogger<FeedbackAutoCloseWorker> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(5, options.Value.SweepSeconds)));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var closed = await FeedbackAutoClose.CloseExpiredAsync(db, DateTime.UtcNow, stoppingToken);
                if (closed > 0) log.LogInformation("Auto-closed {Count} feedback past their deadline", closed);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogWarning(e, "Feedback auto-close sweep failed; retrying next round");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
