import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  OAuthProvider,
  updateProfile,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/queryClient';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: '63838358971-fv3guakh4ib42uag36n98jp121fr7m0h.apps.googleusercontent.com',
  offlineAccess: false,
});

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, teamName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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
      // Sync on session restore so the DB record always exists
      if (firebaseUser) syncUserToBackend(firebaseUser);
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

  const signInWithGoogle = async () => {
    await GoogleSignin.hasPlayServices();
    const { data } = await GoogleSignin.signIn();
    if (!data?.idToken) throw new Error('No ID token from Google');
    const credential = GoogleAuthProvider.credential(data.idToken);
    const result = await signInWithCredential(auth, credential);
    await syncUserToBackend(result.user);
  };

  const signInWithApple = async () => {
    // Firebase requires a nonce to prevent replay attacks
    const rawNonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const { identityToken, fullName } = credential;
    if (!identityToken) throw new Error('No identity token from Apple');

    const provider = new OAuthProvider('apple.com');
    const oauthCredential = provider.credential({ idToken: identityToken, rawNonce });
    const result = await signInWithCredential(auth, oauthCredential);
    const teamName = fullName?.givenName
      ? `${fullName.givenName}${fullName.familyName ? ' ' + fullName.familyName : ''}`
      : undefined;
    await syncUserToBackend(result.user, teamName);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
        resetPassword,
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
