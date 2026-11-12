using Cocoon.Domain.Entities;
using Cocoon.Domain.Enums;
using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Feedbacks;

/// <summary>Bound from "Feedback". AutoCloseDays starts the deadline at the first reply; managers may move it later.</summary>
public sealed class FeedbackOptions
{
    public const int MinDays = 1, MaxDays = 30;
    public int AutoCloseDays { get; set; } = 7;
    /// <summary>The customer may change the rating once within this many days of sending it (Shopee uses 30).</summary>
    public int RatingEditDays { get; set; } = 30;
    public int SweepSeconds { get; set; } = 60;
}

public static class FeedbackAutoClose
{
    /// <summary>
    /// Closes every Replied feedback whose deadline has passed. ClosedAt is the deadline itself, so the history shows when
    /// the feedback was due to close even if the sweep ran later. Feedback waiting on a follow-up reply is never touched.
    /// </summary>
    public static Task<int> CloseExpiredAsync(AppDbContext db, DateTime now, CancellationToken ct) =>
        db.Set<Feedback>()
            .Where(f => f.Status == FeedbackStatus.Replied && f.AutoCloseAt != null && f.AutoCloseAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.Status, FeedbackStatus.Closed).SetProperty(f => f.ClosedAt, f => f.AutoCloseAt)
                .SetProperty(f => f.ClosedBy, (FeedbackClosedBy?)FeedbackClosedBy.AutoClose), ct);
}
