const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
    options?: RequestInit
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${API_URL}${endpoint}`;
    console.log(`[API] Request: ${options?.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    // Get raw text first for debugging
    const rawText = await response.text();
    console.log(`[API] Response ${endpoint} (status ${response.status}):`, rawText.substring(0, 500));

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

  async signup(data: { name: string; email: string; password: string; interests: string[] }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getBubbles() {
    return this.request('/api/bubbles', {
      method: 'GET',
    });
  }

  async getBubble(id: string) {
    return this.request(`/api/bubbles/${id}`, {
      method: 'GET',
    });
  }

  async createBubble(data: any) {
    return this.request('/api/bubbles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async joinBubble(id: string) {
    return this.request(`/api/bubbles/${id}/join`, {
      method: 'POST',
    });
  }

  async leaveBubble(id: string) {
    return this.request(`/api/bubbles/${id}/leave`, {
      method: 'POST',
    });
  }

  async getMyBubbles() {
    return this.request('/api/bubbles/my', {
      method: 'GET',
    });
  }

  async checkMembership(bubbleId: string): Promise<{ isMember: boolean }> {
    return this.request(`/api/bubbles/${bubbleId}/membership`, {
      method: 'GET',
    });
  }

  async getMyCreatedBubbles() {
    return this.request('/api/bubbles/created/my', {
      method: 'GET',
    });
  }

  async getMyEvents() {
    return this.request('/api/events/my', {
      method: 'GET',
    });
  }

  async getMyCreatedEvents() {
    return this.request('/api/events/created', {
      method: 'GET',
    });
  }

  async getBubbleEvents(bubbleId: string) {
    return this.request(`/api/bubbles/${bubbleId}/events`, {
      method: 'GET',
    });
  }

  async getEvent(id: string) {
    return this.request(`/api/events/${id}`, {
      method: 'GET',
    });
  }

  async createEvent(data: any) {
    return this.request('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: any) {
    return this.request(`/api/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string) {
    return this.request(`/api/events/${id}`, {
      method: 'DELETE',
    });
  }

  async rsvpEvent(eventId: string, status: string = 'going') {
    return this.request(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async cancelRsvp(eventId: string) {
    return this.request(`/api/events/${eventId}/rsvp`, {
      method: 'DELETE',
    });
  }

  async getEventAttendees(eventId: string) {
    return this.request(`/api/events/${eventId}/attendees`, {
      method: 'GET',
    });
  }
}

export const apiService = new ApiService();
export default apiService;
