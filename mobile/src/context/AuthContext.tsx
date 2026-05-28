import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  OAuthProvider,
  updateProfile,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/queryClient';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, teamName: string) => Promise<void>;
  signInWithGoogleCredential: (idToken: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function syncUserToBackend(user: User, teamName?: string) {
  try {
    const idToken = await user.getIdToken();
    await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        email: user.email,
        teamName: teamName ?? user.displayName ?? user.email?.split('@')[0] ?? 'Player',
        profileImageUrl: user.photoURL,
      }),
    });
  } catch (err) {
    console.error('Failed to sync user to backend:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await syncUserToBackend(cred.user);
  };

  const signUpWithEmail = async (email: string, password: string, teamName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: teamName });
    await syncUserToBackend(cred.user, teamName);
  };

  // Called from the login screen after expo-auth-session completes the Google OAuth flow
  const signInWithGoogleCredential = async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    await syncUserToBackend(result.user);
  };

  const signInWithApple = async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const { identityToken, fullName } = credential;
    if (!identityToken) throw new Error('No identity token from Apple');
    const provider = new OAuthProvider('apple.com');
    const oauthCredential = provider.credential({ idToken: identityToken });
    const result = await signInWithCredential(auth, oauthCredential);
    const teamName = fullName?.givenName
      ? `${fullName.givenName}${fullName.familyName ? ' ' + fullName.familyName : ''}`
      : undefined;
    await syncUserToBackend(result.user, teamName);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogleCredential,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
