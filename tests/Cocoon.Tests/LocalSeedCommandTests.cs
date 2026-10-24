using Cocoon.Api.Seeding;

namespace Cocoon.Tests;

public sealed class LocalSeedCommandTests
{
    [Fact]
    public void Development_compose_database_is_allowed() =>
        Assert.True(LocalSeedCommand.IsAllowedTarget("Development", "Host=db;Database=cocoon;Username=local"));

    [Theory]
    [InlineData("Production", "Host=db;Database=cocoon")]
    [InlineData("Staging", "Host=db;Database=cocoon")]
    [InlineData("Development", "Host=remote.example;Database=cocoon")]
    [InlineData("Development", "Host=db,remote.example;Database=cocoon")]
    [InlineData("Development", "Host=localhost;Database=cocoon")]
    [InlineData("Development", "Host=db;Database=another_project")]
    [InlineData("Development", "Host=db;Port=6543;Database=cocoon")]
    [InlineData("Development", "invalid connection")]
    [InlineData("Development", null)]
    public void Non_local_or_unconfigured_targets_are_rejected(string environmentName, string? connectionString) =>
        Assert.False(LocalSeedCommand.IsAllowedTarget(environmentName, connectionString));
}
