using System.Data;
using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Tests;

public sealed partial class ReportsApiTests
{
    /// <summary>Runs the delivered SQL against the fixture database and compares all twelve outputs with real HTTP responses.</summary>
    private async Task AssertReportSqlMatchesApi(int manager, DateTimeOffset? from = null, DateTimeOffset? to = null)
    {
        var script = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "db", "verify-reports.sql"));
        var start = script.IndexOf("-- Result set 01:", StringComparison.Ordinal);
        var end = script.LastIndexOf("COMMIT;", StringComparison.Ordinal);
        Assert.True(start >= 0 && end > start, "The delivered report SQL must contain its result-set markers and final COMMIT.");
        // psql interpolation is replaced with bound values; no timestamp input is inserted into SQL text.
        var sql = script[start..end].Replace(":'report_from'", "@report_from", StringComparison.Ordinal)
            .Replace(":'report_to'", "@report_to", StringComparison.Ordinal);
        var sets = new List<List<Dictionary<string, object?>>>();
        await using (var db = Database.CreateContext())
        {
            await db.Database.OpenConnectionAsync();
            var connection = db.Database.GetDbConnection();
            await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.RepeatableRead);
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "SET TRANSACTION READ ONLY; SET LOCAL TIME ZONE 'UTC';\n" + sql;
            foreach (var (name, value) in new[] { ("report_from", from), ("report_to", to) })
            {
                var parameter = command.CreateParameter();
                parameter.ParameterName = name;
                parameter.DbType = DbType.String;
                parameter.Value = value?.ToString("O", CultureInfo.InvariantCulture) ?? "";
                command.Parameters.Add(parameter);
            }
            await using (var reader = await command.ExecuteReaderAsync())
            {
                do
                {
                    if (reader.FieldCount == 0) continue;
                    var rows = new List<Dictionary<string, object?>>();
                    while (await reader.ReadAsync())
                    {
                        var row = new Dictionary<string, object?>(StringComparer.Ordinal);
                        for (var i = 0; i < reader.FieldCount; i++)
                            row[reader.GetName(i)] = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                        rows.Add(row);
                    }
                    sets.Add(rows);
                } while (await reader.NextResultAsync());
            }
            await transaction.CommitAsync();
        }
        Assert.Equal(12, sets.Count);
        var bounds = new List<string>();
        if (from is { } lower) bounds.Add("from=" + Uri.EscapeDataString(lower.ToString("O", CultureInfo.InvariantCulture)));
        if (to is { } upper) bounds.Add("to=" + Uri.EscapeDataString(upper.ToString("O", CultureInfo.InvariantCulture)));
        var period = bounds.Count == 0 ? "" : "?" + string.Join("&", bounds);
        var ages = await Get("customers/age", manager);
        var genders = await Get("customers/gender", manager);
        var preferences = await Get("customers/preferences", manager);
        var overview = await Get("overview" + period, manager);
        var ratings = await Get("feedback/ratings" + period, manager);
        var purchases = await Get("purchases/categories" + period, manager);
        var recommendations = await Get("recommendations" + period, manager);

        void Value(object? expected, JsonElement actual, string field)
        {
            if (expected is null) Assert.True(actual.ValueKind == JsonValueKind.Null, $"{field}: SQL null differs from API {actual}.");
            else if (expected is string text) Assert.Equal(text, actual.GetString());
            else if (expected is DateTime timestamp) Assert.Equal(timestamp.ToUniversalTime(), actual.GetDateTime().ToUniversalTime());
            else Assert.True(Convert.ToDecimal(expected, CultureInfo.InvariantCulture) == actual.GetDecimal(), $"{field}: SQL {expected} differs from API {actual}.");
        }
        void Rows(int index, JsonElement actual, params (string Sql, string Json)[] columns)
        {
            var rows = actual.EnumerateArray().ToArray();
            Assert.Equal(sets[index].Count, rows.Length);
            for (var i = 0; i < rows.Length; i++)
                foreach (var column in columns) Value(sets[index][i][column.Sql], rows[i].GetProperty(column.Json), $"result {index + 1}, row {i}, {column.Json}");
        }
        Rows(0, ages.GetProperty("items"), ("age_group", "group"), ("customers", "customers"));
        Value(sets[0][0]["total_customers"], ages.GetProperty("totalCustomers"), "totalCustomers");
        Rows(1, genders.GetProperty("items"), ("gender", "gender"), ("customers", "customers"));
        Rows(2, preferences.GetProperty("items"), ("preference_id", "preferenceId"), ("preference", "preference"), ("customers", "customers"), ("percentage", "percentage"));
        Value(Assert.Single(sets[9])["eligible_customers"], preferences.GetProperty("consentingCustomers"), "consentingCustomers without selections");
        foreach (var row in sets[2]) Value(row["consenting_customers"], preferences.GetProperty("consentingCustomers"), "consentingCustomers");
        foreach (var (source, target) in new[] { ("total_customers", "totalCustomers"), ("new_customers_30d", "newCustomers30d"),
            ("new_customers_this_month", "newCustomersThisMonth"), ("new_feedback", "newFeedback"), ("avg_rating", "avgRating"),
            ("rating_count", "ratingCount"), ("open_surveys", "openSurveys"), ("completed_responses", "completedResponses") })
            Value(Assert.Single(sets[3])[source], overview.GetProperty(target), target);
        Rows(4, ratings.GetProperty("distribution"), ("rating", "rating"), ("feedback_count", "feedbackCount"));
        Rows(5, ratings.GetProperty("byMonth"), ("month", "month"), ("feedback_count", "feedbackCount"), ("avg_rating", "avgRating"), ("low_rating_rate", "lowRatingRate"));
        string[] ageLabels = ["<18", "18–24", "25–34", "35–44", "≥45", "Chưa cung cấp"];
        foreach (var row in sets[6]) row["age_group"] = ageLabels[Convert.ToInt32(row["age_bucket"], CultureInfo.InvariantCulture)];
        Rows(6, purchases.GetProperty("items"), ("category_id", "categoryId"), ("category", "category"), ("age_group", "ageGroup"),
            ("revenue", "revenue"), ("quantity", "quantity"), ("order_count", "orderCount"));
        Rows(7, ratings.GetProperty("byProduct"), ("product_id", "productId"), ("product", "product"), ("feedback_count", "feedbackCount"), ("avg_rating", "avgRating"));
        Rows(8, ratings.GetProperty("byCategory"), ("category_id", "categoryId"), ("category", "category"), ("feedback_count", "feedbackCount"), ("avg_rating", "avgRating"));
        foreach (var (source, target) in new[] { ("eligible_customers", "eligibleCustomers"), ("covered_customers", "coveredCustomers"),
            ("recommendation_count", "recommendationCount"), ("clicks", "clickedCount"), ("dismissals", "dismissedCount"), ("coverage", "coverage"),
            ("click_rate", "clickRate"), ("dismiss_rate", "dismissRate"), ("active_plans", "activePlans"), ("last_built_at", "lastBuiltAt") })
            Value(Assert.Single(sets[9])[source], recommendations.GetProperty(target), target);
        Rows(10, recommendations.GetProperty("topProducts"), ("id", "id"), ("name", "name"), ("recommendation_count", "recommendationCount"),
            ("clicks", "clicks"), ("dismissals", "dismissals"), ("click_rate", "clickRate"), ("dismiss_rate", "dismissRate"));
        Rows(11, recommendations.GetProperty("byPlan"), ("plan_id", "planId"), ("plan_name", "planName"), ("customer_count", "customerCount"),
            ("recommendation_count", "recommendationCount"), ("clicks", "clicks"), ("dismissals", "dismissals"), ("click_rate", "clickRate"), ("dismiss_rate", "dismissRate"));
    }
}
