import React, { useState } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import '../styles/profile.css';

export const Profile: React.FC = () => {
  const { currentProfile, updateProfile, uploadAvatar, loading } = useProfile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // 기본 아바타 URL
  const DEFAULT_AVATAR = '/default-profile-avatar.png';

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
        setShowPhotoOptions(false);
      } catch (error) {
        console.error('Avatar upload failed:', error);
      }
    }
  };

  const handleSetDefaultPhoto = () => {
    if (updateProfile) {
      updateProfile({ avatarUrl: DEFAULT_AVATAR });
    }
    setShowPhotoOptions(false);
  };

  const handleRemovePhoto = async () => {
    try {
      await updateProfile({ avatarUrl: null });
      setShowPhotoOptions(false);
    } catch (error) {
      console.error('Failed to remove photo:', error);
    }
  };

  const triggerFileInput = () => {
    document.getElementById('avatar-file-input')?.click();
    setShowPhotoOptions(false);
  };

  // 디버깅용
  console.log('Current avatar URL:', currentProfile?.avatarUrl);

  if (loading) return <div>Loading profile...</div>;
  if (!currentProfile) return <div>No profile found</div>;

  return (
    <div className="profile-container">
      <div className="avatar-section">
        {/* 프로필 이미지 */}
        <div className="profile-avatar-wrapper">
          {currentProfile.avatarUrl ? (
            <img 
              src={currentProfile.avatarUrl} 
              alt="Profile Avatar" 
              className="profile-avatar"
            />
          ) : (
            <div className="profile-avatar-placeholder">
              <span>👤</span>
            </div>
          )}
          <div className="avatar-status-indicator" />
        </div>

        {/* Photo 버튼 */}
        <div className="photo-button-container">
          <button 
            className="photo-button"
            onClick={() => setShowPhotoOptions(!showPhotoOptions)}
          >
            📷 Photo
          </button>

          {/* Photo 옵션 드롭다운 */}
          {showPhotoOptions && (
            <div className="photo-options-menu">
              <button 
                className="photo-option"
                onClick={handleSetDefaultPhoto}
              >
                🏠 Use Default Photo
              </button>
              <button 
                className="photo-option"
                onClick={handleRemovePhoto}
              >
                🚫 No Photo
              </button>
              <button 
                className="photo-option"
                onClick={triggerFileInput}
              >
                📁 Upload Photo
              </button>
            </div>
          )}
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          id="avatar-file-input"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* 업로드 확인 버튼 (파일 선택 후) */}
        {selectedFile && (
          <div className="upload-confirmation">
            <p>Selected: {selectedFile.name}</p>
            <button onClick={handleAvatarUpload} className="upload-confirm-btn">
              ✅ Confirm Upload
            </button>
            <button onClick={() => setSelectedFile(null)} className="upload-cancel-btn">
              ❌ Cancel
            </button>
          </div>
        )}
      </div>
      
      <div className="profile-info">
        <h2>{currentProfile.displayName}</h2>
        <p className="profile-role">{currentProfile.role}</p>
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-value">{currentProfile.performanceScore || 0}%</span>
            <span className="stat-label">Performance</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{currentProfile.status || 'Active'}</span>
            <span className="stat-label">Status</span>
          </div>
        </div>
      </div>
    </div>
  );
};
