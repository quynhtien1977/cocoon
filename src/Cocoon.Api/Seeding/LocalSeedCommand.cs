using Cocoon.Domain.Entities;
using Cocoon.Infrastructure.Persistence;
using Cocoon.Infrastructure.Seeding;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Cocoon.Api.Seeding;

public static class LocalSeedCommand
{
    public static bool IsAllowedTarget(string environmentName, string? connectionString)
    {
        if (!environmentName.Equals("Development", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(connectionString))
            return false;
        try
        {
            var target = new NpgsqlConnectionStringBuilder(connectionString);
            return target.Host == "db" && target.Port == 5432 && target.Database == "cocoon";
        }
        catch (ArgumentException) { return false; }
    }

    public static async Task<int> RunAsync(IHostEnvironment environment, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("Default");
        if (!IsAllowedTarget(environment.EnvironmentName, connection))
        {
            Console.Error.WriteLine("Seed v1 chỉ chạy ở Development với database cocoon trong Compose local (host db, port 5432). Không có dữ liệu nào được ghi.");
            return 2;
        }
        try
        {
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
            if ((await db.Database.GetPendingMigrationsAsync()).Any())
            {
                Console.Error.WriteLine("Database local chưa cập nhật migration. Áp dụng EF migration trước khi chạy seed.");
                return 2;
            }
            var hasher = new PasswordHasher<Account>();
            var added = await new DemoDataSeeder(db,
                account => hasher.HashPassword(account, "Demo@12345"), DateTime.UtcNow.Date).RunAsync();
            Console.WriteLine($"Seed v1 hoàn tất: thêm {added} bản ghi. Dữ liệu hiện có được giữ nguyên.");
            return 0;
        }
        catch (Exception error)
        {
            // Exception messages can contain connection parameters or database values. Do not print them.
            Console.Error.WriteLine($"Seed v1 không hoàn tất. Kiểm tra cấu hình local và dữ liệu demo. Loại lỗi: {error.GetType().Name}.");
            return 1;
        }
    }
}
