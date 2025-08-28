export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  displayName: string;
  role: string;
  department: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}
