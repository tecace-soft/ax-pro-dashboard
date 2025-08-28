import React, { useState } from 'react';
import { useProfile } from '../contexts/ProfileContext';

export const Profile: React.FC = () => {
  const { currentProfile, updateProfile, uploadAvatar, loading } = useProfile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (selectedFile) {
      try {
        await uploadAvatar(selectedFile);
        setSelectedFile(null);
      } catch (error) {
        console.error('Avatar upload failed:', error);
      }
    }
  };

  if (loading) return <div>Loading profile...</div>;
  if (!currentProfile) return <div>No profile found</div>;

  return (
    <div className="profile-container">
      <div className="avatar-section">
        <img 
          src={currentProfile.avatarUrl} 
          alt="Profile Avatar" 
          className="profile-avatar"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="avatar-input"
        />
        <button onClick={handleAvatarUpload} disabled={!selectedFile}>
          Upload Avatar
        </button>
      </div>
      
      <div className="profile-info">
        <h2>{currentProfile.displayName}</h2>
        <p>{currentProfile.email}</p>
        <p>{currentProfile.role} - {currentProfile.department}</p>
        {currentProfile.bio && <p>{currentProfile.bio}</p>}
      </div>
    </div>
  );
};
