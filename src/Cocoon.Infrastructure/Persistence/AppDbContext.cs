using Cocoon.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cocoon.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder model)
    {
        var account = model.Entity<Account>();
        account.HasKey(x => x.Id);
        account.HasIndex(x => x.Email).IsUnique();
        account.Property(x => x.Email).HasMaxLength(256);
        account.Property(x => x.PasswordHash).HasMaxLength(1024);
        account.Property(x => x.Role).HasConversion<string>().HasMaxLength(32);
        account.HasQueryFilter(x => !x.IsDeleted);

        var customer = model.Entity<CustomerProfile>();
        customer.HasKey(x => x.AccountId);
        customer.HasOne(x => x.Account).WithOne().HasForeignKey<CustomerProfile>(x => x.AccountId);
        customer.HasQueryFilter(x => !x.Account.IsDeleted);
        customer.HasIndex(x => x.FullNameNormalized);
        customer.HasIndex(x => x.Phone);
        customer.Property(x => x.Address).HasMaxLength(1000);
        customer.Property(x => x.Phone).HasMaxLength(32);
        customer.Property(x => x.Gender).HasMaxLength(32);

        var staff = model.Entity<StaffProfile>();
        staff.HasKey(x => x.AccountId);
        staff.HasOne(x => x.Account).WithOne().HasForeignKey<StaffProfile>(x => x.AccountId);
        staff.HasQueryFilter(x => !x.Account.IsDeleted);
        staff.Property(x => x.Phone).HasMaxLength(32);

        model.Entity<Preference>().HasKey(x => x.Id);
        model.Entity<Category>().HasKey(x => x.Id);
        var customerPreference = model.Entity<CustomerPreference>();
        customerPreference.HasKey(x => new { x.CustomerId, x.PreferenceId });
        customerPreference.HasOne<CustomerProfile>().WithMany().HasForeignKey(x => x.CustomerId);
        customerPreference.HasOne<Preference>().WithMany().HasForeignKey(x => x.PreferenceId);
        customerPreference.Property(x => x.Source).HasConversion<string>().HasMaxLength(32);

        var supplier = model.Entity<Supplier>();
        supplier.HasKey(x => x.Id);
        supplier.HasQueryFilter(x => !x.IsDeleted);
        supplier.Property(x => x.Phone).HasMaxLength(32);
        supplier.Property(x => x.Email).HasMaxLength(256);

        var product = model.Entity<Product>();
        product.HasKey(x => x.Id);
        product.HasOne<Category>().WithMany().HasForeignKey(x => x.CategoryId);
        product.HasOne<Supplier>().WithMany().HasForeignKey(x => x.SupplierId);
        product.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        product.HasQueryFilter(x => !x.IsDeleted);
        product.HasIndex(x => x.NameNormalized);
        product.HasIndex(x => x.Status);
        product.HasIndex(x => x.CategoryId);
        product.HasIndex(x => x.CreatedAt);
        product.Property(x => x.Description).HasMaxLength(4000);
        product.Property(x => x.Ingredients).HasMaxLength(4000);
        product.Property(x => x.Benefits).HasMaxLength(4000);
        product.Property(x => x.Usage).HasMaxLength(4000);

        var productPreference = model.Entity<ProductPreference>();
        productPreference.HasKey(x => new { x.ProductId, x.PreferenceId });
        productPreference.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        productPreference.HasOne<Preference>().WithMany().HasForeignKey(x => x.PreferenceId);

        var variant = model.Entity<ProductVariant>();
        variant.HasKey(x => x.Id);
        variant.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        variant.HasIndex(x => x.Sku).IsUnique();
        variant.Property(x => x.Sku).HasMaxLength(100);
        variant.Property(x => x.Price).HasPrecision(18, 2);
        variant.Property(x => x.ImageUrl).HasMaxLength(2048);
        variant.ToTable(table => table.HasCheckConstraint("CK_ProductVariant_Price", "\"Price\" > 0"));
        variant.HasQueryFilter(x => !x.IsDeleted);

        var feedback = model.Entity<Feedback>();
        feedback.HasKey(x => x.Id);
        feedback.HasOne<CustomerProfile>().WithMany().HasForeignKey(x => x.CustomerId);
        feedback.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        feedback.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.AcceptedBy);
        feedback.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.AssignedStaffId);
        // One review per purchased line; manager-entered feedback has no order line.
        feedback.HasOne<OrderItem>().WithMany().HasForeignKey(x => x.OrderItemId);
        feedback.HasIndex(x => x.OrderItemId).IsUnique();
        feedback.Property(x => x.Content).HasMaxLength(1000);
        feedback.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        feedback.ToTable(table => table.HasCheckConstraint("CK_Feedback_Rating", "\"Rating\" BETWEEN 1 AND 5"));
        feedback.HasIndex(x => x.Status);
        feedback.HasIndex(x => x.CustomerId);
        feedback.HasIndex(x => x.AssignedStaffId);
        feedback.HasIndex(x => x.ProductId);
        feedback.HasIndex(x => x.CreatedAt);

        var assignment = model.Entity<FeedbackAssignment>();
        assignment.HasKey(x => x.Id);
        assignment.HasOne<Feedback>().WithMany().HasForeignKey(x => x.FeedbackId);
        assignment.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.StaffId);
        assignment.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.AssignedBy);
        var reply = model.Entity<FeedbackReply>();
        reply.HasKey(x => x.Id);
        reply.HasOne<Feedback>().WithOne().HasForeignKey<FeedbackReply>(x => x.FeedbackId);
        reply.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.StaffId);
        reply.Property(x => x.Content).HasMaxLength(4000);

        var survey = model.Entity<Survey>();
        survey.HasKey(x => x.Id);
        survey.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.CreatedBy);
        survey.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        survey.Property(x => x.Purpose).HasConversion<string>().HasMaxLength(32);
        survey.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        survey.Property(x => x.Description).HasMaxLength(4000);
        survey.ToTable(table => table.HasCheckConstraint("CK_Survey_Dates", "\"CloseAt\" >= \"OpenAt\""));
        survey.HasQueryFilter(x => !x.IsDeleted);

        var question = model.Entity<SurveyQuestion>();
        question.HasKey(x => x.Id);
        question.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId);
        question.Property(x => x.Type).HasConversion<string>().HasMaxLength(32);
        question.Property(x => x.Text).HasMaxLength(1000);
        var option = model.Entity<QuestionOption>();
        option.HasKey(x => x.Id);
        option.HasOne<SurveyQuestion>().WithMany().HasForeignKey(x => x.QuestionId);
        option.Property(x => x.Text).HasMaxLength(1000);
        option.HasOne<Preference>().WithMany().HasForeignKey(x => x.PreferenceId);

        var recipient = model.Entity<SurveyRecipient>();
        recipient.HasKey(x => x.Id);
        recipient.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId);
        recipient.HasOne<CustomerProfile>().WithMany().HasForeignKey(x => x.CustomerId);
        recipient.HasIndex(x => new { x.SurveyId, x.CustomerId }).IsUnique();
        recipient.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        var response = model.Entity<SurveyResponse>();
        response.HasKey(x => x.Id);
        response.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId);
        response.HasOne<CustomerProfile>().WithMany().HasForeignKey(x => x.CustomerId);
        response.HasIndex(x => new { x.SurveyId, x.CustomerId }).IsUnique();
        var answer = model.Entity<SurveyAnswer>();
        answer.HasKey(x => x.Id);
        answer.HasOne<SurveyResponse>().WithMany().HasForeignKey(x => x.ResponseId);
        answer.HasOne<SurveyQuestion>().WithMany().HasForeignKey(x => x.QuestionId);
        answer.HasOne<QuestionOption>().WithMany().HasForeignKey(x => x.OptionId);
        answer.Property(x => x.NumericValue).HasPrecision(18, 2);
        answer.Property(x => x.TextValue).HasMaxLength(1000);

        var order = model.Entity<Order>();
        order.HasKey(x => x.Id);
        order.HasOne<CustomerProfile>().WithMany().HasForeignKey(x => x.CustomerId);
        order.HasIndex(x => x.Code).IsUnique();
        order.Property(x => x.Code).HasMaxLength(20);
        order.Property(x => x.Channel).HasConversion<string>().HasMaxLength(32);
        order.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        order.Property(x => x.TotalAmount).HasPrecision(12, 0);
        order.HasIndex(x => new { x.CustomerId, x.OrderedAt }).IsDescending(false, true);
        var orderItem = model.Entity<OrderItem>();
        orderItem.HasKey(x => x.Id);
        orderItem.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId);
        orderItem.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.ProductVariantId);
        orderItem.HasIndex(x => x.ProductVariantId);
        orderItem.Property(x => x.UnitPrice).HasPrecision(12, 0);
        orderItem.ToTable(table => table.HasCheckConstraint("CK_OrderItem_Quantity", "\"Quantity\" > 0"));

        var plan = model.Entity<RecommendationPlan>();
        plan.HasKey(x => x.Id);
        plan.HasOne<StaffProfile>().WithMany().HasForeignKey(x => x.CreatedBy);
        plan.Property(x => x.Name).HasMaxLength(120);
        plan.Property(x => x.Goal).HasMaxLength(1000);
        plan.Property(x => x.Segment).HasColumnType("jsonb");
        plan.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        plan.ToTable(table => table.HasCheckConstraint("CK_RecommendationPlan_Dates", "\"EndAt\" > \"StartAt\""));
        var planProduct = model.Entity<RecommendationPlanProduct>();
        planProduct.HasKey(x => new { x.PlanId, x.ProductId });
        planProduct.HasOne<RecommendationPlan>().WithMany().HasForeignKey(x => x.PlanId);
        planProduct.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        var recommendation = model.Entity<Recommendation>();
        recommendation.HasKey(x => x.Id);
        recommendation.HasOne<CustomerProfile>().WithMany().HasForeignKey(x => x.CustomerId);
        recommendation.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        recommendation.HasOne<RecommendationPlan>().WithMany().HasForeignKey(x => x.PlanId);
        recommendation.Property(x => x.Score).HasPrecision(5, 4);
        recommendation.Property(x => x.Breakdown).HasColumnType("jsonb");
        recommendation.Property(x => x.Reasons).HasColumnType("jsonb");
        recommendation.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        recommendation.ToTable(table => table.HasCheckConstraint("CK_Recommendation_Score", "\"Score\" BETWEEN 0 AND 1"));
        recommendation.HasIndex(x => new { x.CustomerId, x.Status });
        // Older Active rows are expired before a rebuild inserts new ones.
        recommendation.HasIndex(x => new { x.CustomerId, x.ProductId }).IsUnique().HasFilter("\"Status\" = 'Active'");

        var notification = model.Entity<Notification>();
        notification.HasKey(x => x.Id);
        notification.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId);
        notification.HasIndex(x => new { x.AccountId, x.IsRead, x.CreatedAt });
        var log = model.Entity<ActivityLog>();
        log.HasKey(x => x.Id);
        log.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId);
        log.Property(x => x.Detail).HasMaxLength(4000);
        log.HasIndex(x => x.CreatedAt);
        var refresh = model.Entity<RefreshToken>();
        refresh.HasKey(x => x.Id);
        refresh.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId);
        refresh.HasIndex(x => x.TokenHash).IsUnique();
        refresh.Property(x => x.TokenHash).HasMaxLength(128);
        var reset = model.Entity<PasswordResetToken>();
        reset.HasKey(x => x.Id);
        reset.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId);
        reset.HasIndex(x => x.TokenHash).IsUnique();
        reset.Property(x => x.TokenHash).HasMaxLength(128);

        foreach (var entity in model.Model.GetEntityTypes())
        {
            entity.SetTableName(entity.ClrType.Name);
            foreach (var property in entity.GetProperties().Where(x => x.ClrType == typeof(string) && x.GetMaxLength() is null
                && x.GetColumnType() != "jsonb"))
                property.SetMaxLength(256);
            // Historical records must survive soft deletion; block physical parent deletion.
            foreach (var foreignKey in entity.GetForeignKeys())
                foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
        }
    }
}
