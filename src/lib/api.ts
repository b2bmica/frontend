const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'API request failed');
    }

    return data;
  }

  // Auth
  async register(data: { hotelName: string; userName: string; email: string; password: string; address?: string; phone?: string }) {
    return this.request<{ token: string; user: any; hotel: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; user: any; hotel: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async verifyOtp(email: string, otp: string) {
    return this.request<{ token: string; user: any; hotel: any }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async forgotPassword(email: string) {
    return this.request<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(data: any) {
    return this.request<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe() {
    return this.request<{ user: any; hotel: any }>('/auth/me');
  }

  async updateHotel(data: any) {
    return this.request<any>('/auth/hotel', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHotel() {
    return this.request<any>('/auth/hotel', {
      method: 'DELETE',
    });
  }

  // Rooms
  async getRooms() {
    return this.request<any[]>('/rooms');
  }

  async createRoom(data: { roomNumber: string; roomType: string; price: number; amenities?: string[] }) {
    return this.request<any>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoom(id: string, data: any) {
    return this.request<any>(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRoom(id: string) {
    return this.request<any>(`/rooms/${id}`, {
      method: 'DELETE',
    });
  }

  async updateRoomStatus(id: string, status: string) {
    return this.request<any>(`/rooms/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Bookings
  async getBookings(params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<{ bookings: any[]; pagination: any }>(`/bookings${qs ? '?' + qs : ''}`);
  }

  async createBooking(data: { roomId: string; guestId: string; checkin: string; checkout: string; adults?: number; children?: number; advancePayment?: number; bookingSource?: string }) {
    return this.request<any>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBooking(id: string, data: any) {
    return this.request<any>(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelBooking(id: string) {
    return this.request<any>(`/bookings/${id}`, {
      method: 'DELETE',
    });
  }

  async getCalendarData(start: string, end: string) {
    return this.request<any[]>(`/bookings/calendar?start=${start}&end=${end}`);
  }

  async checkAvailability(checkin: string, checkout: string) {
    return this.request<any[]>(`/bookings/availability?checkin=${checkin}&checkout=${checkout}`);
  }

  // Guests
  async getGuests(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<{ guests: any[]; pagination: any }>(`/guests${qs ? '?' + qs : ''}`);
  }

  async createGuest(data: { name: string; phone: string; email?: string; nationality: string; address?: string; idProof: { idType: string; number: string } }) {
    return this.request<any>('/guests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async searchGuests(query: string) {
    return this.request<any[]>(`/guests/search?query=${encodeURIComponent(query)}`);
  }

  async getGuestHistory(id: string) {
    return this.request<any[]>(`/guests/${id}/history`);
  }

  async getGuest(id: string) {
    return this.request<any>(`/guests/${id}`);
  }

  // Housekeeping & Maintenance
  async getHousekeepingBoard() {
    return this.request<any[]>('/housekeeping/tickets');
  }

  async updateCleaningStatus(id: string, status: string) {
    return this.request<any>(`/housekeeping/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getMaintenanceTickets() {
    return this.request<any[]>('/housekeeping/maintenance');
  }

  async createMaintenanceTicket(data: { roomId: string; issue: string; priority: string }) {
    return this.request<any>('/housekeeping/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMaintenanceStatus(id: string, status: string) {
    return this.request<any>(`/housekeeping/maintenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Generic helper
  async get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }
}

export const api = new ApiClient();
