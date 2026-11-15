namespace Cocoon.Application.Email;

/// <summary>Plain text plus optional HTML; the sender adds the configured From address.</summary>
public sealed record EmailMessage(string To, string Subject, string Text, string? Html = null);

/// <summary>Sends one email. Throws <see cref="EmailDeliveryException"/> when it was not handed to the mail server.</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>NotConfigured means no SMTP host is set; anything else is a delivery failure. Never carries the message body.</summary>
public sealed class EmailDeliveryException(string message, bool notConfigured = false, Exception? inner = null) : Exception(message, inner)
{
    public bool NotConfigured { get; } = notConfigured;
}
