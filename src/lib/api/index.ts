// Re-export all types
export * from "./types";

// Import all API classes
import { ApiClient } from "./client";
import { AuthApi } from "./auth";
import { CardsApi } from "./cards";
import { AdminApi } from "./admin";
import { ResourcesApi } from "./resources";
import { ReviewsApi } from "./reviews";
import { HelpWantedApi } from "./help-wanted";
import { ForumsApi } from "./forums";

/**
 * Combined API client that includes all API functionality
 * This class provides backward compatibility with the original monolithic ApiClient
 */
class CombinedApiClient extends ApiClient {
  private authApi: AuthApi;
  private cardsApi: CardsApi;
  private adminApi: AdminApi;
  private resourcesApi: ResourcesApi;
  private reviewsApi: ReviewsApi;
  private helpWantedApi: HelpWantedApi;
  private forumsApi: ForumsApi;

  // Auth methods
  register!: AuthApi["register"];
  login!: AuthApi["login"];
  logout!: AuthApi["logout"];
  getCurrentUser!: AuthApi["getCurrentUser"];
  isAuthenticated!: AuthApi["isAuthenticated"];
  updateEmail!: AuthApi["updateEmail"];
  updatePassword!: AuthApi["updatePassword"];
  updateProfile!: AuthApi["updateProfile"];

  // Card methods
  getCards!: CardsApi["getCards"];
  getCard!: CardsApi["getCard"];
  getBusiness!: CardsApi["getBusiness"];
  getTags!: CardsApi["getTags"];
  submitCard!: CardsApi["submitCard"];
  getUserSubmissions!: CardsApi["getUserSubmissions"];
  suggestCardEdit!: CardsApi["suggestCardEdit"];
  uploadFile!: CardsApi["uploadFile"];

  // Admin methods
  adminGetCards!: AdminApi["getCards"];
  adminCreateCard!: AdminApi["createCard"];
  adminUpdateCard!: AdminApi["updateCard"];
  adminDeleteCard!: AdminApi["deleteCard"];
  adminGetSubmissions!: AdminApi["getSubmissions"];
  adminApproveSubmission!: AdminApi["approveSubmission"];
  adminRejectSubmission!: AdminApi["rejectSubmission"];
  adminGetModifications!: AdminApi["getModifications"];
  adminApproveModification!: AdminApi["approveModification"];
  adminRejectModification!: AdminApi["rejectModification"];
  adminGetUsers!: AdminApi["getUsers"];
  adminUpdateUser!: AdminApi["updateUser"];
  adminDeleteUser!: AdminApi["deleteUser"];
  adminResetUserPassword!: AdminApi["resetUserPassword"];
  adminGetTags!: AdminApi["getTags"];
  adminCreateTag!: AdminApi["createTag"];
  adminUpdateTag!: AdminApi["updateTag"];
  adminDeleteTag!: AdminApi["deleteTag"];

  // Resource methods
  getResourcesConfig!: ResourcesApi["getResourcesConfig"];
  getQuickAccess!: ResourcesApi["getQuickAccess"];
  getResourceItems!: ResourcesApi["getResourceItems"];
  getResourceCategories!: ResourcesApi["getResourceCategories"];
  getResources!: ResourcesApi["getResources"];
  adminGetResourceConfigs!: ResourcesApi["adminGetResourceConfigs"];
  adminUpdateResourceConfig!: ResourcesApi["adminUpdateResourceConfig"];
  adminCreateResourceConfig!: ResourcesApi["adminCreateResourceConfig"];
  adminGetQuickAccessItems!: ResourcesApi["adminGetQuickAccessItems"];
  adminGetQuickAccessItem!: ResourcesApi["adminGetQuickAccessItem"];
  adminCreateQuickAccessItem!: ResourcesApi["adminCreateQuickAccessItem"];
  adminUpdateQuickAccessItem!: ResourcesApi["adminUpdateQuickAccessItem"];
  adminDeleteQuickAccessItem!: ResourcesApi["adminDeleteQuickAccessItem"];
  adminGetResourceItems!: ResourcesApi["adminGetResourceItems"];
  adminGetResourceItem!: ResourcesApi["adminGetResourceItem"];
  adminCreateResourceItem!: ResourcesApi["adminCreateResourceItem"];
  adminUpdateResourceItem!: ResourcesApi["adminUpdateResourceItem"];
  adminDeleteResourceItem!: ResourcesApi["adminDeleteResourceItem"];

  // Review methods
  adminGetReviews!: ReviewsApi["getReviews"];
  adminHideReview!: ReviewsApi["hideReview"];
  adminUnhideReview!: ReviewsApi["unhideReview"];
  adminDismissReviewReport!: ReviewsApi["dismissReviewReport"];
  adminDeleteReview!: ReviewsApi["deleteReview"];

  // Help Wanted methods
  getHelpWantedPosts!: HelpWantedApi["getHelpWantedPosts"];
  getHelpWantedPost!: HelpWantedApi["getHelpWantedPost"];
  createHelpWantedPost!: HelpWantedApi["createHelpWantedPost"];
  updateHelpWantedPost!: HelpWantedApi["updateHelpWantedPost"];
  deleteHelpWantedPost!: HelpWantedApi["deleteHelpWantedPost"];
  createHelpWantedComment!: HelpWantedApi["createHelpWantedComment"];
  updateHelpWantedComment!: HelpWantedApi["updateHelpWantedComment"];
  deleteHelpWantedComment!: HelpWantedApi["deleteHelpWantedComment"];
  reportHelpWantedPost!: HelpWantedApi["reportHelpWantedPost"];
  getMyHelpWantedPosts!: HelpWantedApi["getMyHelpWantedPosts"];
  adminGetHelpWantedReports!: HelpWantedApi["adminGetHelpWantedReports"];
  adminResolveHelpWantedReport!: HelpWantedApi["adminResolveHelpWantedReport"];
  adminGetHelpWantedPosts!: HelpWantedApi["adminGetHelpWantedPosts"];
  adminDeleteHelpWantedPost!: HelpWantedApi["adminDeleteHelpWantedPost"];

  // Forum methods
  getForumCategories!: ForumsApi["getForumCategories"];
  getForumCategory!: ForumsApi["getForumCategory"];
  getCategoryThreads!: ForumsApi["getCategoryThreads"];
  getForumThread!: ForumsApi["getForumThread"];
  createForumThread!: ForumsApi["createForumThread"];
  updateForumThread!: ForumsApi["updateForumThread"];
  deleteForumThread!: ForumsApi["deleteForumThread"];
  createForumPost!: ForumsApi["createForumPost"];
  updateForumPost!: ForumsApi["updateForumPost"];
  deleteForumPost!: ForumsApi["deleteForumPost"];
  reportForumThread!: ForumsApi["reportForumThread"];
  reportForumPost!: ForumsApi["reportForumPost"];
  requestForumCategory!: ForumsApi["requestForumCategory"];
  getMyForumCategoryRequests!: ForumsApi["getMyForumCategoryRequests"];
  getMyForumThreads!: ForumsApi["getMyForumThreads"];
  getMyForumPosts!: ForumsApi["getMyForumPosts"];
  adminGetForumCategories!: ForumsApi["adminGetForumCategories"];
  adminCreateForumCategory!: ForumsApi["adminCreateForumCategory"];
  adminUpdateForumCategory!: ForumsApi["adminUpdateForumCategory"];
  adminDeleteForumCategory!: ForumsApi["adminDeleteForumCategory"];
  adminGetForumCategoryRequests!: ForumsApi["adminGetForumCategoryRequests"];
  adminApproveForumCategoryRequest!: ForumsApi["adminApproveForumCategoryRequest"];
  adminRejectForumCategoryRequest!: ForumsApi["adminRejectForumCategoryRequest"];
  adminGetForumThreads!: ForumsApi["adminGetForumThreads"];
  adminPinForumThread!: ForumsApi["adminPinForumThread"];
  adminLockForumThread!: ForumsApi["adminLockForumThread"];
  adminDeleteForumThread!: ForumsApi["adminDeleteForumThread"];
  adminGetForumReports!: ForumsApi["adminGetForumReports"];
  adminResolveForumReport!: ForumsApi["adminResolveForumReport"];

  constructor() {
    super();

    // Initialize API instances
    this.authApi = new AuthApi();
    this.cardsApi = new CardsApi();
    this.adminApi = new AdminApi();
    this.resourcesApi = new ResourcesApi();
    this.reviewsApi = new ReviewsApi();
    this.helpWantedApi = new HelpWantedApi();
    this.forumsApi = new ForumsApi();

    // Bind auth methods
    this.register = this.authApi.register.bind(this.authApi);
    this.login = this.authApi.login.bind(this.authApi);
    this.logout = this.authApi.logout.bind(this.authApi);
    this.getCurrentUser = this.authApi.getCurrentUser.bind(this.authApi);
    this.isAuthenticated = this.authApi.isAuthenticated.bind(this.authApi);
    this.updateEmail = this.authApi.updateEmail.bind(this.authApi);
    this.updatePassword = this.authApi.updatePassword.bind(this.authApi);
    this.updateProfile = this.authApi.updateProfile.bind(this.authApi);

    // Bind card methods
    this.getCards = this.cardsApi.getCards.bind(this.cardsApi);
    this.getCard = this.cardsApi.getCard.bind(this.cardsApi);
    this.getBusiness = this.cardsApi.getBusiness.bind(this.cardsApi);
    this.getTags = this.cardsApi.getTags.bind(this.cardsApi);
    this.submitCard = this.cardsApi.submitCard.bind(this.cardsApi);
    this.getUserSubmissions = this.cardsApi.getUserSubmissions.bind(
      this.cardsApi
    );
    this.suggestCardEdit = this.cardsApi.suggestCardEdit.bind(this.cardsApi);
    this.uploadFile = this.cardsApi.uploadFile.bind(this.cardsApi);

    // Bind admin methods
    this.adminGetCards = this.adminApi.getCards.bind(this.adminApi);
    this.adminCreateCard = this.adminApi.createCard.bind(this.adminApi);
    this.adminUpdateCard = this.adminApi.updateCard.bind(this.adminApi);
    this.adminDeleteCard = this.adminApi.deleteCard.bind(this.adminApi);
    this.adminGetSubmissions = this.adminApi.getSubmissions.bind(this.adminApi);
    this.adminApproveSubmission = this.adminApi.approveSubmission.bind(
      this.adminApi
    );
    this.adminRejectSubmission = this.adminApi.rejectSubmission.bind(
      this.adminApi
    );
    this.adminGetModifications = this.adminApi.getModifications.bind(
      this.adminApi
    );
    this.adminApproveModification = this.adminApi.approveModification.bind(
      this.adminApi
    );
    this.adminRejectModification = this.adminApi.rejectModification.bind(
      this.adminApi
    );
    this.adminGetUsers = this.adminApi.getUsers.bind(this.adminApi);
    this.adminUpdateUser = this.adminApi.updateUser.bind(this.adminApi);
    this.adminDeleteUser = this.adminApi.deleteUser.bind(this.adminApi);
    this.adminResetUserPassword = this.adminApi.resetUserPassword.bind(
      this.adminApi
    );
    this.adminGetTags = this.adminApi.getTags.bind(this.adminApi);
    this.adminCreateTag = this.adminApi.createTag.bind(this.adminApi);
    this.adminUpdateTag = this.adminApi.updateTag.bind(this.adminApi);
    this.adminDeleteTag = this.adminApi.deleteTag.bind(this.adminApi);

    // Bind resource methods
    this.getResourcesConfig = this.resourcesApi.getResourcesConfig.bind(
      this.resourcesApi
    );
    this.getQuickAccess = this.resourcesApi.getQuickAccess.bind(
      this.resourcesApi
    );
    this.getResourceItems = this.resourcesApi.getResourceItems.bind(
      this.resourcesApi
    );
    this.getResourceCategories = this.resourcesApi.getResourceCategories.bind(
      this.resourcesApi
    );
    this.getResources = this.resourcesApi.getResources.bind(this.resourcesApi);
    this.adminGetResourceConfigs =
      this.resourcesApi.adminGetResourceConfigs.bind(this.resourcesApi);
    this.adminUpdateResourceConfig =
      this.resourcesApi.adminUpdateResourceConfig.bind(this.resourcesApi);
    this.adminCreateResourceConfig =
      this.resourcesApi.adminCreateResourceConfig.bind(this.resourcesApi);
    this.adminGetQuickAccessItems =
      this.resourcesApi.adminGetQuickAccessItems.bind(this.resourcesApi);
    this.adminGetQuickAccessItem =
      this.resourcesApi.adminGetQuickAccessItem.bind(this.resourcesApi);
    this.adminCreateQuickAccessItem =
      this.resourcesApi.adminCreateQuickAccessItem.bind(this.resourcesApi);
    this.adminUpdateQuickAccessItem =
      this.resourcesApi.adminUpdateQuickAccessItem.bind(this.resourcesApi);
    this.adminDeleteQuickAccessItem =
      this.resourcesApi.adminDeleteQuickAccessItem.bind(this.resourcesApi);
    this.adminGetResourceItems = this.resourcesApi.adminGetResourceItems.bind(
      this.resourcesApi
    );
    this.adminGetResourceItem = this.resourcesApi.adminGetResourceItem.bind(
      this.resourcesApi
    );
    this.adminCreateResourceItem =
      this.resourcesApi.adminCreateResourceItem.bind(this.resourcesApi);
    this.adminUpdateResourceItem =
      this.resourcesApi.adminUpdateResourceItem.bind(this.resourcesApi);
    this.adminDeleteResourceItem =
      this.resourcesApi.adminDeleteResourceItem.bind(this.resourcesApi);

    // Bind review methods
    this.adminGetReviews = this.reviewsApi.getReviews.bind(this.reviewsApi);
    this.adminHideReview = this.reviewsApi.hideReview.bind(this.reviewsApi);
    this.adminUnhideReview = this.reviewsApi.unhideReview.bind(this.reviewsApi);
    this.adminDismissReviewReport = this.reviewsApi.dismissReviewReport.bind(
      this.reviewsApi
    );
    this.adminDeleteReview = this.reviewsApi.deleteReview.bind(this.reviewsApi);

    // Bind help wanted methods
    this.getHelpWantedPosts = this.helpWantedApi.getHelpWantedPosts.bind(
      this.helpWantedApi
    );
    this.getHelpWantedPost = this.helpWantedApi.getHelpWantedPost.bind(
      this.helpWantedApi
    );
    this.createHelpWantedPost = this.helpWantedApi.createHelpWantedPost.bind(
      this.helpWantedApi
    );
    this.updateHelpWantedPost = this.helpWantedApi.updateHelpWantedPost.bind(
      this.helpWantedApi
    );
    this.deleteHelpWantedPost = this.helpWantedApi.deleteHelpWantedPost.bind(
      this.helpWantedApi
    );
    this.createHelpWantedComment =
      this.helpWantedApi.createHelpWantedComment.bind(this.helpWantedApi);
    this.updateHelpWantedComment =
      this.helpWantedApi.updateHelpWantedComment.bind(this.helpWantedApi);
    this.deleteHelpWantedComment =
      this.helpWantedApi.deleteHelpWantedComment.bind(this.helpWantedApi);
    this.reportHelpWantedPost = this.helpWantedApi.reportHelpWantedPost.bind(
      this.helpWantedApi
    );
    this.getMyHelpWantedPosts = this.helpWantedApi.getMyHelpWantedPosts.bind(
      this.helpWantedApi
    );
    this.adminGetHelpWantedReports =
      this.helpWantedApi.adminGetHelpWantedReports.bind(this.helpWantedApi);
    this.adminResolveHelpWantedReport =
      this.helpWantedApi.adminResolveHelpWantedReport.bind(this.helpWantedApi);
    this.adminGetHelpWantedPosts =
      this.helpWantedApi.adminGetHelpWantedPosts.bind(this.helpWantedApi);
    this.adminDeleteHelpWantedPost =
      this.helpWantedApi.adminDeleteHelpWantedPost.bind(this.helpWantedApi);

    // Bind forum methods
    this.getForumCategories = this.forumsApi.getForumCategories.bind(
      this.forumsApi
    );
    this.getForumCategory = this.forumsApi.getForumCategory.bind(
      this.forumsApi
    );
    this.getCategoryThreads = this.forumsApi.getCategoryThreads.bind(
      this.forumsApi
    );
    this.getForumThread = this.forumsApi.getForumThread.bind(this.forumsApi);
    this.createForumThread = this.forumsApi.createForumThread.bind(
      this.forumsApi
    );
    this.updateForumThread = this.forumsApi.updateForumThread.bind(
      this.forumsApi
    );
    this.deleteForumThread = this.forumsApi.deleteForumThread.bind(
      this.forumsApi
    );
    this.createForumPost = this.forumsApi.createForumPost.bind(this.forumsApi);
    this.updateForumPost = this.forumsApi.updateForumPost.bind(this.forumsApi);
    this.deleteForumPost = this.forumsApi.deleteForumPost.bind(this.forumsApi);
    this.reportForumThread = this.forumsApi.reportForumThread.bind(
      this.forumsApi
    );
    this.reportForumPost = this.forumsApi.reportForumPost.bind(this.forumsApi);
    this.requestForumCategory = this.forumsApi.requestForumCategory.bind(
      this.forumsApi
    );
    this.getMyForumCategoryRequests =
      this.forumsApi.getMyForumCategoryRequests.bind(this.forumsApi);
    this.getMyForumThreads = this.forumsApi.getMyForumThreads.bind(
      this.forumsApi
    );
    this.getMyForumPosts = this.forumsApi.getMyForumPosts.bind(this.forumsApi);
    this.adminGetForumCategories = this.forumsApi.adminGetForumCategories.bind(
      this.forumsApi
    );
    this.adminCreateForumCategory =
      this.forumsApi.adminCreateForumCategory.bind(this.forumsApi);
    this.adminUpdateForumCategory =
      this.forumsApi.adminUpdateForumCategory.bind(this.forumsApi);
    this.adminDeleteForumCategory =
      this.forumsApi.adminDeleteForumCategory.bind(this.forumsApi);
    this.adminGetForumCategoryRequests =
      this.forumsApi.adminGetForumCategoryRequests.bind(this.forumsApi);
    this.adminApproveForumCategoryRequest =
      this.forumsApi.adminApproveForumCategoryRequest.bind(this.forumsApi);
    this.adminRejectForumCategoryRequest =
      this.forumsApi.adminRejectForumCategoryRequest.bind(this.forumsApi);
    this.adminGetForumThreads = this.forumsApi.adminGetForumThreads.bind(
      this.forumsApi
    );
    this.adminPinForumThread = this.forumsApi.adminPinForumThread.bind(
      this.forumsApi
    );
    this.adminLockForumThread = this.forumsApi.adminLockForumThread.bind(
      this.forumsApi
    );
    this.adminDeleteForumThread = this.forumsApi.adminDeleteForumThread.bind(
      this.forumsApi
    );
    this.adminGetForumReports = this.forumsApi.adminGetForumReports.bind(
      this.forumsApi
    );
    this.adminResolveForumReport = this.forumsApi.adminResolveForumReport.bind(
      this.forumsApi
    );
  }
}

// Export the combined API client instance for backward compatibility
export const apiClient = new CombinedApiClient();

// Also export individual API classes for modular usage
export { AuthApi } from "./auth";
export { CardsApi } from "./cards";
export { AdminApi } from "./admin";
export { ResourcesApi } from "./resources";
export { ReviewsApi } from "./reviews";
export { HelpWantedApi } from "./help-wanted";
export { ForumsApi } from "./forums";
