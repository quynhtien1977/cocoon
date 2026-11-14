namespace Cocoon.Domain.Enums;

public enum AccountRole { Admin, Manager, Staff, Customer }
public enum ProductStatus { Active, Inactive, Upcoming }
public enum FeedbackStatus { New, Accepted, Assigned, Replied, Closed }
/// <summary>Who ended a Closed feedback. Closing ends the conversation only; the rating still counts in reports.</summary>
public enum FeedbackClosedBy { Manager, SecondReply, AutoClose, Customer }
public enum SurveyPurpose { Satisfaction, NewProduct, Other }
public enum SurveyStatus { Draft, Open, Closed }
public enum QuestionType { SingleChoice, MultiChoice, Rating, ShortText }
public enum RecipientStatus { NotDone, Done }
public enum PreferenceSource { Declared, Survey }
public enum OrderChannel { Website, Store, Marketplace }
/// <summary>
/// Website orders move Placed → Delivering (staff or manager confirms) → Completed (the customer confirms receipt); a
/// Placed order can be Cancelled by its customer. Only Completed lines can be reviewed or count in reports. New values
/// go last so the numeric order of older ones never changes.
/// </summary>
public enum OrderStatus { Completed, Cancelled, Returned, Placed, Delivering }
public enum RecommendationStatus { Active, Clicked, Dismissed, Expired }
public enum RecommendationPlanStatus { Draft, Active, Ended }

