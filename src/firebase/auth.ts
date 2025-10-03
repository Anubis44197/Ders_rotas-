import { auth } from './config';
import { signInAnonymously, User } from 'firebase/auth';

// Kullanıcı rolleri için enum
export enum UserRole {
  Parent = 'parent',
  Child = 'child'
}

// Kullanıcı profil tipi
export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  familyId: string; // Aile grubu ID'si
  createdAt: number;
}

// Anonymous authentication ile oturum aç
export const signInAsAnonymous = async (role: UserRole, name: string): Promise<UserProfile> => {
  try {
    const result = await signInAnonymously(auth);
    const user = result.user;
    
    // Aile ID'si oluştur (ilk parent için) veya mevcut olanı kullan
    const familyId = localStorage.getItem('familyId') || `family_${Date.now()}`;
    localStorage.setItem('familyId', familyId);
    
    const userProfile: UserProfile = {
      uid: user.uid,
      role,
      name,
      familyId,
      createdAt: Date.now()
    };
    
    // Kullanıcı profilini localStorage'a kaydet
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    
    return userProfile;
  } catch (error) {
    console.error('Anonymous sign in error:', error);
    throw error;
  }
};

// Mevcut kullanıcı profilini al
export const getCurrentUserProfile = (): UserProfile | null => {
  try {
    const storedProfile = localStorage.getItem('userProfile');
    return storedProfile ? JSON.parse(storedProfile) : null;
  } catch (error) {
    console.error('Error getting current user profile:', error);
    return null;
  }
};

// Kullanıcı oturumunu sonlandır
export const signOutUser = async (): Promise<void> => {
  try {
    await auth.signOut();
    localStorage.removeItem('userProfile');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Auth state değişikliklerini dinle
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return auth.onAuthStateChanged(callback);
};