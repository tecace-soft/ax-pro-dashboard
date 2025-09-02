import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '../types/profile';
import { profileService } from '../services/profileService';

interface ProfileContextType {
  currentProfile: UserProfile | null;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  refreshProfile: () => Promise<void>;
  loading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProfile = async () => {
    try {
      setLoading(true);
      // 현재 로그인한 사용자 ID를 가져오는 로직 필요
      const userId = 'current-user-id'; // 실제 구현에서는 auth context에서 가져와야 함
      const profile = await profileService.getProfile(userId);
      setCurrentProfile(profile);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!currentProfile) return;
    
    try {
      setLoading(true);
      const updatedProfile = await profileService.updateProfile(currentProfile.id, profileData);
      setCurrentProfile(updatedProfile);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!currentProfile) return;
    
    try {
      setLoading(true);
      const { avatarUrl } = await profileService.uploadAvatar(currentProfile.id, file);
      await updateProfile({ avatarUrl });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <ProfileContext.Provider value={{
      currentProfile,
      updateProfile,
      uploadAvatar,
      refreshProfile,
      loading
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
