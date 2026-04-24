import * as Sentry from '@sentry/react-native';
import { reportError } from '../utils/crashReporter';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://163cfc20-e221-41ad-b2c3-67afe2df4e33-00-15yrg27byh3aa.spock.replit.dev" ||
  "http://localhost:3000";

const SLOW_CALL_THRESHOLD_MS = 2000;

type AuthResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    interests: string[];
  };
  token: string;
};

class ApiService {
  private token: string | null = null;
  private onTokenRevokedCallback: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  setOnTokenRevoked(callback: (() => void) | null) {
    this.onTokenRevokedCallback = callback;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const url = `${API_URL}${endpoint}`;
    const method = options?.method || 'GET';
    console.log(`[API] Request: ${method} ${url}`);

    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    // Get raw text first for debugging
    const rawText = await response.text();
    const durationMs = Date.now() - startTime;
    console.log(
      `[API] Response ${endpoint} (status ${response.status}):`,
      rawText.substring(0, 500),
    );

    if (endpoint !== "/api/telemetry/latency") {
      fetch(`${API_URL}/api/telemetry/latency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, method, durationMs, statusCode: response.status }),
      }).catch(() => {});
    }

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(rawText);
      } catch {
        error = { error: response.statusText };
      }
      if (response.status === 401 && error.error === 'Token revoked') {
        this.onTokenRevokedCallback?.();
      }
      const statusCode = response.status;
      if (statusCode >= 500) {
        console.error(`[API] Server error: ${method} ${endpoint} (${statusCode}) in ${durationMs} ms`);
        reportError(new Error(`Server error ${statusCode}: ${method} ${endpoint}`), 'API');
      } else if (statusCode === 401) {
        console.warn(`[API] Unauthorized: ${method} ${endpoint} in ${durationMs} ms`);
      } else if (statusCode >= 400) {
        console.warn(`[API] Client error: ${method} ${endpoint} (${statusCode}) in ${durationMs} ms`);
      }
      const apiError = new Error(error.error || response.statusText) as Error & { status: number };
      apiError.status = response.status;
      throw apiError;
    }

    try {
      const result = JSON.parse(rawText);
      if (durationMs > SLOW_CALL_THRESHOLD_MS) {
        console.warn(`[API] Slow response: ${method} ${endpoint} completed in ${durationMs} ms`);
        Sentry.withScope((scope) => {
          scope.setLevel('warning');
          scope.setTag('alert_type', 'slow_api_response');
          scope.setTag('endpoint', endpoint);
          scope.setTag('method', method);
          scope.setExtra('durationMs', durationMs);
          scope.setExtra('threshold', SLOW_CALL_THRESHOLD_MS);
          Sentry.captureMessage(`[API] Slow response: ${method} ${endpoint}`, 'warning');
        });
      } else {
        Sentry.logger.info(`[API] ${method} ${endpoint} completed in ${durationMs} ms`, { endpoint, method, durationMs });
      }
      return result;
    } catch (parseError) {
      console.error(`[API] JSON parse error for ${endpoint}:`, parseError);
      console.error(`[API] Raw response was:`, rawText.substring(0, 1000));
      throw parseError;
    }
  }

  async signup(data: {
    name: string;
    email: string;
    password: string;
    interests: string[];
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async serverLogout() {
    return this.request("/api/auth/logout", { method: "POST" });
  }

  async getProfile() {
    return this.request("/api/auth/me");
  }

  async getCometChatAuthToken(): Promise<{ authToken: string; uid: string }> {
    return this.request("/api/cometchat/auth-token", { method: "POST" }) as Promise<{ authToken: string; uid: string }>;
  }

  async updateProfile(updates: { aboutMe?: string; interests?: string[]; profilePhoto?: string; name?: string }) {
    return this.request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async getUserPublicProfile(userId: string): Promise<{ id: string; name: string; profilePhoto: string | null }> {
    return this.request<{ id: string; name: string; profilePhoto: string | null }>(`/api/users/${userId}/profile`);
  }

  async getBubbles() {
    return this.request("/api/bubbles", {
      method: "GET",
    });
  }

  async getBubble(id: string): Promise<any> {
    return this.request<any>(`/api/bubbles/${id}`, {
      method: "GET",
    });
  }

  async createBubble(data: any) {
    return this.request("/api/bubbles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBubble(id: string, data: any) {
    return this.request(`/api/bubbles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBubble(id: string) {
    return this.request(`/api/bubbles/${id}`, {
      method: "DELETE",
    });
  }

  async joinBubble(id: string): Promise<{ success: boolean; status: string }> {
    return this.request(`/api/bubbles/${id}/join`, {
      method: "POST",
    });
  }

  async leaveBubble(id: string) {
    return this.request(`/api/bubbles/${id}/leave`, {
      method: "POST",
    });
  }

  async syncChatMembers(bubbleId: string) {
    return this.request(`/api/bubbles/${bubbleId}/sync-chat-members`, {
      method: "POST",
    });
  }

  async getMyBubbles() {
    return this.request("/api/bubbles/my", {
      method: "GET",
    });
  }

  async checkMembership(
    bubbleId: string,
  ): Promise<{ isMember: boolean; role: string | null; membershipStatus: string | null }> {
    return this.request(`/api/bubbles/${bubbleId}/membership`, {
      method: "GET",
    });
  }

  async getBubbleMembers(bubbleId: string) {
    return this.request(`/api/bubbles/${bubbleId}/members`, {
      method: "GET",
    });
  }

  async getWaitlist(bubbleId: string) {
    return this.request(`/api/bubbles/${bubbleId}/waitlist`, { method: "GET" });
  }

  async approveWaitlist(bubbleId: string, userId: string) {
    return this.request(`/api/bubbles/${bubbleId}/waitlist/${userId}/approve`, { method: "POST" });
  }

  async holdWaitlist(bubbleId: string, userId: string, reason?: string) {
    return this.request(`/api/bubbles/${bubbleId}/waitlist/${userId}/hold`, {
      method: "POST",
      body: reason ? JSON.stringify({ reason }) : undefined,
    });
  }

  async rejectWaitlist(bubbleId: string, userId: string, reason?: string) {
    return this.request(`/api/bubbles/${bubbleId}/waitlist/${userId}/reject`, {
      method: "POST",
      body: reason ? JSON.stringify({ reason }) : undefined,
    });
  }

  async getAdminWaitlist() {
    return this.request(`/api/admin/waitlist`, { method: "GET" });
  }

  async updateMemberRole(bubbleId: string, userId: string, role: string) {
    return this.request(`/api/bubbles/${bubbleId}/members/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  }

  async relinquishAdmin(bubbleId: string) {
    return this.request(
      `/api/bubbles/${bubbleId}/members/me/relinquish-admin`,
      {
        method: "PUT",
      },
    );
  }

  async removeMember(bubbleId: string, userId: string) {
    return this.request(`/api/bubbles/${bubbleId}/members/${userId}`, {
      method: "DELETE",
    });
  }

  async getJoinRequests(bubbleId: string) {
    return this.request(`/api/bubbles/${bubbleId}/join-requests`, {
      method: "GET",
    });
  }

  async approveJoinRequest(bubbleId: string, userId: string) {
    return this.request(`/api/bubbles/${bubbleId}/join-requests/${userId}/approve`, {
      method: "POST",
    });
  }

  async rejectJoinRequest(bubbleId: string, userId: string) {
    return this.request(`/api/bubbles/${bubbleId}/join-requests/${userId}/reject`, {
      method: "POST",
    });
  }

  async initiateAdminDm(bubbleId: string, userId: string) {
    return this.request(`/api/bubbles/${bubbleId}/admin-dm/${userId}`, {
      method: "POST",
    });
  }

  async getMyCreatedBubbles() {
    return this.request("/api/bubbles/created/my", {
      method: "GET",
    });
  }

  async getMyEvents() {
    return this.request("/api/events/my", {
      method: "GET",
    });
  }

  async getMyCreatedEvents() {
    return this.request("/api/events/created", {
      method: "GET",
    });
  }

  async getUpcomingEvents() {
    return this.request("/api/events/upcoming", {
      method: "GET",
    });
  }

  async getBubbleEvents(bubbleId: string) {
    return this.request(`/api/bubbles/${bubbleId}/events`, {
      method: "GET",
    });
  }

  async getEvent(id: string) {
    return this.request(`/api/events/${id}`, {
      method: "GET",
    });
  }

  async createEvent(data: any) {
    return this.request("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: any) {
    return this.request(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string) {
    return this.request(`/api/events/${id}`, {
      method: "DELETE",
    });
  }

  async rsvpEvent(eventId: string, status: string = "going") {
    return this.request(`/api/events/${eventId}/rsvp`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  async cancelRsvp(eventId: string) {
    return this.request(`/api/events/${eventId}/rsvp`, {
      method: "DELETE",
    });
  }

  async getEventAttendees(eventId: string) {
    return this.request(`/api/events/${eventId}/attendees`, {
      method: "GET",
    });
  }

  // Campus methods
  async getCampuses() {
    return this.request<{ id: string; domain: string; title: string }[]>(
      "/api/campuses",
    );
  }

  async sendCampusVerification(email: string) {
    return this.request<{
      success: boolean;
      message: string;
      campusId: string;
      campusName: string;
      devCode?: string;
      emailFailed?: boolean;
      fallbackCode?: string;
    }>("/api/campus/send-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async verifyCampusCode(email: string, code: string) {
    return this.request<{
      success: boolean;
      campus: { id: string; name: string; domain: string };
      user: any;
    }>("/api/campus/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  }

  async dismissCampusPrompt() {
    return this.request("/api/campus/dismiss-prompt", {
      method: "POST",
    });
  }

  async getCampusBubbles() {
    return this.request<any[]>("/api/campus/bubbles");
  }

  async getCampusEvents() {
    return this.request<any[]>("/api/campus/events");
  }

  async getMyCampus() {
    return this.request<{
      campus: { id: string; name: string; domain: string } | null;
      verified: boolean;
    }>("/api/campus/my-campus");
  }

  // Session tracking
  async startSession() {
    return this.request<{ id: string }>("/api/sessions/start", {
      method: "POST",
    });
  }

  async endSession(sessionId: string) {
    return this.request<any>(`/api/sessions/${sessionId}/end`, {
      method: "POST",
    });
  }

  // Bubble visit tracking
  async trackBubbleVisit(bubbleId: string) {
    return this.request<any>(`/api/bubbles/${bubbleId}/visit`, {
      method: "POST",
    });
  }

  async getAdminPendingCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>("/api/admin/pending-count");
  }

  // Admin - Pending reviews
  async getPendingBubbles() {
    return this.request<any[]>("/api/admin/pending-bubbles");
  }

  async getPendingEvents() {
    return this.request<any[]>("/api/admin/pending-events");
  }

  async approveBubble(bubbleId: string) {
    return this.request<any>(`/api/admin/bubbles/${bubbleId}/approve`, {
      method: "POST",
    });
  }

  async rejectBubble(bubbleId: string, reason?: string) {
    return this.request<any>(`/api/admin/bubbles/${bubbleId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async approveEvent(eventId: string) {
    return this.request<any>(`/api/admin/events/${eventId}/approve`, {
      method: "POST",
    });
  }

  async rejectEvent(eventId: string, reason?: string) {
    return this.request<any>(`/api/admin/events/${eventId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async submitReport(data: {
    reportType: string;
    reason: string;
    freeText?: string;
    reportedUserId?: string;
    bubbleId: string;
    eventId?: string;
  }) {
    return this.request<any>("/api/reports", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAdminReports() {
    return this.request<any[]>("/api/admin/reports", {
      method: "GET",
    });
  }

  async getBubbleReports(bubbleId: string) {
    return this.request<any[]>(`/api/bubbles/${bubbleId}/reports`, {
      method: "GET",
    });
  }

  async updateReportStatus(reportId: string, status: string) {
    return this.request<any>(`/api/reports/${reportId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
  async getNotifications(limit = 50, offset = 0): Promise<any[]> {
    return this.request<any[]>(`/api/notifications?limit=${limit}&offset=${offset}`);
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>("/api/notifications/unread-count");
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.request<any>(`/api/notifications/${id}/read`, { method: "PUT" });
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request<any>("/api/notifications/read-all", { method: "POST" });
  }

  async deleteNotification(id: string): Promise<any> {
    return this.request<any>(`/api/notifications/${id}`, { method: "DELETE" });
  }

  async registerPushToken(token: string, platform: string): Promise<any> {
    return this.request<any>("/api/device-push-tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    });
  }

  async getBulletinPostTypes(): Promise<any[]> {
    return this.request<any[]>("/api/bulletin/post-types");
  }

  async getBulletinBoard(bubbleId: string): Promise<any> {
    return this.request<any>(`/api/bubbles/${bubbleId}/bulletin`);
  }

  async getBulletinPosts(bubbleId: string, postTypeId?: number): Promise<any[]> {
    const query = postTypeId ? `?postTypeId=${postTypeId}` : '';
    return this.request<any[]>(`/api/bubbles/${bubbleId}/bulletin/posts${query}`);
  }

  async getBulletinPost(postId: string): Promise<any> {
    return this.request<any>(`/api/bulletin/posts/${postId}`);
  }

  async createBulletinPost(bubbleId: string, data: { postTypeId: number; title: string; body: string; imageUrl?: string }): Promise<any> {
    return this.request<any>(`/api/bubbles/${bubbleId}/bulletin/posts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBulletinPost(postId: string, data: { postTypeId?: number; title?: string; body?: string; imageUrl?: string }): Promise<any> {
    return this.request<any>(`/api/bulletin/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBulletinPost(postId: string): Promise<any> {
    return this.request<any>(`/api/bulletin/posts/${postId}`, { method: "DELETE" });
  }

  async toggleBulletinPostPin(postId: string): Promise<any> {
    return this.request<any>(`/api/bulletin/posts/${postId}/pin`, { method: "PATCH" });
  }

  async toggleBulletinReaction(postId: string, emoji: string = 'heart'): Promise<{ added: boolean }> {
    return this.request<{ added: boolean }>(`/api/bulletin/posts/${postId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
  }

  async getShareBaseUrl(): Promise<{ baseUrl: string }> {
    return this.request<{ baseUrl: string }>('/api/config/share-base-url');
  }

  async getBubbleByShortId(shortId: string): Promise<any> {
    return this.request<any>(`/b/${shortId}`);
  }

  async getBulletinReplies(postId: string): Promise<any[]> {
    return this.request<any[]>(`/api/bulletin/posts/${postId}/replies`);
  }

  async createBulletinReply(postId: string, body: string): Promise<any> {
    return this.request<any>(`/api/bulletin/posts/${postId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async addBubblePhoto(bubbleId: string, imageUrl: string): Promise<any> {
    return this.request<any>(`/api/bubbles/${bubbleId}/photos`, {
      method: "POST",
      body: JSON.stringify({ imageUrl }),
    });
  }

  async getAppConfig(key: string): Promise<{ key: string; value: string }> {
    return this.request<{ key: string; value: string }>(`/api/config/app?key=${encodeURIComponent(key)}`);
  }

  async getEffectiveRules(bubbleId: string): Promise<{ level: string; ruleId: number; text: string; position: number; hidden: boolean }[]> {
    return this.request<{ level: string; ruleId: number; text: string; position: number; hidden: boolean }[]>(`/api/rules/effective/${bubbleId}`);
  }

  async getAppRules(): Promise<any[]> {
    return this.request<any[]>('/api/rules/app');
  }

  async getBubbleCustomRules(bubbleId: string): Promise<any[]> {
    return this.request<any[]>(`/api/rules/bubble/${bubbleId}`);
  }

  async addBubbleRule(bubbleId: string, name: string, description: string, position: number): Promise<any> {
    return this.request<any>(`/api/rules/bubble/${bubbleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, position }),
    });
  }

  async updateBubbleRule(bubbleId: string, ruleId: number, name: string, description: string): Promise<any> {
    return this.request<any>(`/api/rules/bubble/${bubbleId}/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
  }

  async deleteBubbleRule(bubbleId: string, ruleId: number): Promise<any> {
    return this.request<any>(`/api/rules/bubble/${bubbleId}/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async reorderBubbleRules(bubbleId: string, ruleIds: number[]): Promise<any> {
    return this.request<any>(`/api/rules/bubble/${bubbleId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleIds }),
    });
  }

  async setBubbleRuleOverride(bubbleId: string, ruleId: number, hidden: boolean): Promise<any> {
    return this.request<any>(`/api/rules/bubble/${bubbleId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, hidden }),
    });
  }

  async getCategoryRules(categoryId: number): Promise<any[]> {
    return this.request<any[]>(`/api/rules/category/${categoryId}`);
  }

  async addCategoryRule(categoryId: number, name: string, description: string, position: number): Promise<any> {
    return this.request<any>(`/api/rules/category/${categoryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, position }),
    });
  }

  async updateCategoryRule(categoryId: number, ruleId: number, name: string, description: string): Promise<any> {
    return this.request<any>(`/api/rules/category/${categoryId}/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
  }

  async deleteCategoryRule(categoryId: number, ruleId: number): Promise<any> {
    return this.request<any>(`/api/rules/category/${categoryId}/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async reorderCategoryRules(categoryId: number, ruleIds: number[]): Promise<any> {
    return this.request<any>(`/api/rules/category/${categoryId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleIds }),
    });
  }

  async addAppRule(name: string, description: string, position: number): Promise<any> {
    return this.request<any>('/api/rules/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, position }),
    });
  }

  async updateAppRule(ruleId: number, name: string, description: string): Promise<any> {
    return this.request<any>(`/api/rules/app/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
  }

  async deleteAppRule(ruleId: number): Promise<any> {
    return this.request<any>(`/api/rules/app/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async reorderAppRules(ruleIds: number[]): Promise<any> {
    return this.request<any>('/api/rules/app/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleIds }),
    });
  }

  async getCategoriesFlat(): Promise<any[]> {
    return this.request<any[]>('/api/categories/flat');
  }
}

export const apiService = new ApiService();
export default apiService;
