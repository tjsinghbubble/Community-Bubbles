const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://163cfc20-e221-41ad-b2c3-67afe2df4e33-00-15yrg27byh3aa.spock.replit.dev" ||
  "http://localhost:3000";

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

  setToken(token: string | null) {
    this.token = token;
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
    console.log(`[API] Request: ${options?.method || "GET"} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    // Get raw text first for debugging
    const rawText = await response.text();
    console.log(
      `[API] Response ${endpoint} (status ${response.status}):`,
      rawText.substring(0, 500),
    );

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(rawText);
      } catch {
        error = { error: response.statusText };
      }
      throw new Error(error.error || response.statusText);
    }

    try {
      return JSON.parse(rawText);
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

  async getProfile() {
    return this.request("/api/auth/me");
  }

  async getBubbles() {
    return this.request("/api/bubbles", {
      method: "GET",
    });
  }

  async getBubble(id: string) {
    return this.request(`/api/bubbles/${id}`, {
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

  async createBulletinPost(bubbleId: string, data: { postTypeId: number; title: string; body: string }): Promise<any> {
    return this.request<any>(`/api/bubbles/${bubbleId}/bulletin/posts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteBulletinPost(postId: string): Promise<any> {
    return this.request<any>(`/api/bulletin/posts/${postId}`, { method: "DELETE" });
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
}

export const apiService = new ApiService();
export default apiService;
