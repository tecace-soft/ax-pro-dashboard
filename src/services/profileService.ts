import { getAuthToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173/api';

export const profileService = {
  // 프로필 가져오기
  async getProfile(userId: string): Promise<UserProfile> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/profiles/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    
    return response.json();
  },

  // 프로필 업데이트
  async updateProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/profiles/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profileData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update profile');
    }
    
    return response.json();
  },

  // 아바타 업로드
  async uploadAvatar(userId: string, file: File): Promise<{ avatarUrl: string }> {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await fetch(`${API_BASE_URL}/profiles/${userId}/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload avatar');
    }
    
    return response.json();
  }
};
