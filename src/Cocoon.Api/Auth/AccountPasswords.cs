using Cocoon.Application.Accounts;
using Cocoon.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace Cocoon.Api.Auth;

public sealed class AccountPasswords(IPasswordHasher<Account> hasher) : IAccountPasswords
{
    public string Hash(Account account, string password) => hasher.HashPassword(account, password);
    public bool Verify(Account account, string password) =>
        hasher.VerifyHashedPassword(account, account.PasswordHash, password) != PasswordVerificationResult.Failed;
}
