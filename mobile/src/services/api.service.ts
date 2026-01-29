const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async signup(data: { name: string; email: string; password: string; interests: string[] }) {
    return this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
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

export default new ApiService();
