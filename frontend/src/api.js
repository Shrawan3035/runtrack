const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';


const getHeaders = () => {
  const token = localStorage.getItem('runtrack_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  login: async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to login');
    }
    const data = await res.json();
    localStorage.setItem('runtrack_token', data.token);
    localStorage.setItem('runtrack_user', JSON.stringify(data));
    return data;
  },

  register: async (username, password, name) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to register');
    }
    return res.text();
  },

  getProfile: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  updateProfile: async (profileData) => {
    const res = await fetch(`${API_BASE_URL}/auth/profile/update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(profileData),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  logout: () => {
    localStorage.removeItem('runtrack_token');
    localStorage.removeItem('runtrack_user');
  },

  // Activities
  getActivities: async () => {
    const res = await fetch(`${API_BASE_URL}/activities`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
  },

  logActivity: async (activityData) => {
    const res = await fetch(`${API_BASE_URL}/activities`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(activityData),
    });
    if (!res.ok) throw new Error('Failed to log activity');
    return res.json();
  },

  deleteActivity: async (id) => {
    const res = await fetch(`${API_BASE_URL}/activities/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete activity');
    return res.text();
  },

  updateActivity: async (id, activityData) => {
    const res = await fetch(`${API_BASE_URL}/activities/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(activityData),
    });
    if (!res.ok) throw new Error('Failed to update activity');
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE_URL}/activities/stats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // AI features
  chatCoach: async (messages) => {
    const res = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to chat with AI Coach');
    }
    return res.json();
  },

  getWorkoutSuggestion: async () => {
    const res = await fetch(`${API_BASE_URL}/ai/workout`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch workout suggestion');
    return res.json();
  },

  getMarathonPlan: async () => {
    const res = await fetch(`${API_BASE_URL}/ai/marathon`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch marathon plan');
    return res.json();
  },

  generateMarathonPlan: async (startDate, targetDate, targetDistance, runsPerWeek) => {
    const res = await fetch(`${API_BASE_URL}/ai/marathon`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ startDate, targetDate, targetDistance, runsPerWeek }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to generate marathon plan');
    }
    return res.json();
  },

  saveMarathonPlan: async (planData) => {
    const res = await fetch(`${API_BASE_URL}/ai/marathon/save`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(planData),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to save marathon plan');
    }
    return res.json();
  },

  resetMarathonPlan: async () => {
    const res = await fetch(`${API_BASE_URL}/ai/marathon`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reset marathon plan');
    return res.json();
  },

  toggleMarathonDayInDb: async (dayKey) => {
    const res = await fetch(`${API_BASE_URL}/ai/marathon/toggle-day`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ dayKey }),
    });
    if (!res.ok) throw new Error('Failed to toggle day completion');
    return res.json();
  },

  deleteAccount: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Failed to delete account');
    }
    return res.text();
  },
};
