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

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || response.statusText);
    }

    return response.json();
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
}

export const apiService = new ApiService();
export default apiService;
