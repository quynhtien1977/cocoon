using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using Cocoon.Application.Email;
using Microsoft.Extensions.Options;

namespace Cocoon.Infrastructure.Email;

/// <summary>
/// Smtp__* settings. Local Docker Compose points them at Mailpit (no login, no TLS); a personal Gmail uses
/// smtp.gmail.com:587 with STARTTLS and an App Password (db/EMAIL.md). An empty Host disables email.
/// </summary>
public sealed class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    /// <summary>STARTTLS. Required by Gmail; Mailpit runs without it.</summary>
    public bool EnableSsl { get; set; } = true;
    public string FromAddress { get; set; } = "no-reply@cocoon.local";
    public string FromName { get; set; } = "Cocoon Việt Nam";
}

/// <summary>System.Net.Mail is enough for one transactional email per request and adds no package.</summary>
public sealed class SmtpEmailSender(IOptions<SmtpOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.Host))
            throw new EmailDeliveryException("SMTP is not configured.", notConfigured: true);
        using var mail = new MailMessage
        {
            From = new MailAddress(o.FromAddress, o.FromName, Encoding.UTF8),
            Subject = message.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = message.Text,
            BodyEncoding = Encoding.UTF8,
        };
        mail.To.Add(new MailAddress(message.To));
        if (message.Html is not null)
            mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.Html, Encoding.UTF8, MediaTypeNames.Text.Html));
        using var client = new SmtpClient(o.Host, o.Port) { EnableSsl = o.EnableSsl, DeliveryMethod = SmtpDeliveryMethod.Network, Timeout = 15000 };
        if (!string.IsNullOrEmpty(o.Username)) client.Credentials = new NetworkCredential(o.Username, o.Password);
        try { await client.SendMailAsync(mail, ct); }
        catch (Exception e) when (e is SmtpException or InvalidOperationException or IOException)
        {
            // The server's reply can echo the login name, so only the type goes into the message; the cause stays inner.
            throw new EmailDeliveryException($"SMTP delivery failed ({e.GetType().Name}).", inner: e);
        }
    }
}
