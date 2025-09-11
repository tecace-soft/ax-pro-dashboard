export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: string;
  department: string;
  bio: string;
  avatarUrl: string | null; // null 허용
  performanceScore?: number; // 추가
  status?: string; // 추가
}
