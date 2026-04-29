import { API_BASE_URL, MOCK_META_URL } from './config';
import { getAccessToken } from './auth';

async function request(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} - ${text}`);
  }

  return response.json();
}

async function requestAbsolute(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} - ${text}`);
  }

  return response.json();
}

export const api = {
  authLogin(payload) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  authLogout(payload) {
    return request('/auth/logout', { method: 'POST', body: JSON.stringify(payload) });
  },
  listUsers() {
    return request('/users');
  },
  updateUserRole(id, payload) {
    return request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  listConversations(params = {}) {
    const query = new URLSearchParams(params);
    return request(`/conversations${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getConversation(id, params = {}) {
    const query = new URLSearchParams(params);
    return request(`/conversations/${id}${query.toString() ? `?${query.toString()}` : ''}`);
  },
  sendMessage(payload) {
    return request('/messages/send', { method: 'POST', body: JSON.stringify(payload) });
  },
  markConversationRead(id) {
    return request(`/conversations/${id}/read`, { method: 'POST' });
  },
  clearAllConversations() {
    return request('/conversations/clear-all', { method: 'POST' });
  },
  hardResetConversations() {
    return request('/conversations/hard-reset', { method: 'POST' });
  },
  clearConversationMessages(id) {
    return request(`/conversations/${id}/clear`, { method: 'POST' });
  },
  getMockMetaConfig() {
    return requestAbsolute(`${MOCK_META_URL}/config`);
  },
  updateMockMetaConfig(payload) {
    return requestAbsolute(`${MOCK_META_URL}/config`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  mockSendMessage(payload) {
    return requestAbsolute(`${MOCK_META_URL}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  mockSimulateInbound(payload) {
    return requestAbsolute(`${MOCK_META_URL}/simulate/inbound`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
