using Cocoon.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Tests;

/// <summary>Owns a fresh local test database, isolated from auth tests and the development database.</summary>
public sealed class DemoSeedDatabaseFixture : IAsyncLifetime
{
    private readonly string _databaseName = $"cocoon_seed_tests_{Guid.NewGuid():N}";
    private string _adminConnection = string.Empty;
    private string _connection = string.Empty;
    private bool _created;

    public async Task InitializeAsync()
    {
        var connection = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? throw new InvalidOperationException("Chạy seed test trong container API local."));
        if (connection.Host != "db" || connection.Database != "cocoon")
            throw new InvalidOperationException("Seed test chỉ dùng host db và database local cocoon.");
        _adminConnection = connection.ConnectionString;
        await using var admin = new NpgsqlConnection(_adminConnection);
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand($"CREATE DATABASE \"{_databaseName}\"", admin);
        await create.ExecuteNonQueryAsync();
        _created = true;
        connection.Database = _databaseName;
        _connection = connection.ConnectionString;
        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connection).Options);

    public async Task DisposeAsync()
    {
        if (!_created) return;
        var target = new NpgsqlConnectionStringBuilder(_connection);
        if (target.Host != "db" || target.Database != _databaseName || !_databaseName.StartsWith("cocoon_seed_tests_", StringComparison.Ordinal))
            throw new InvalidOperationException("Không được dọn database ngoài seed test đã tạo.");
        using var pool = new NpgsqlConnection(_connection);
        NpgsqlConnection.ClearPool(pool);
        await using var admin = new NpgsqlConnection(_adminConnection);
        await admin.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE \"{_databaseName}\"", admin);
        await drop.ExecuteNonQueryAsync();
    }
}
