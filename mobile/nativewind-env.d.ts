/// <reference types="nativewind/types" />

// Makes this file a module so that declare module below is an augmentation (not replacement)
export {};

// firebase/auth browser types don't include getReactNativePersistence.
// Metro resolves to the RN bundle at runtime (which does export it).
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: object,
  ): { readonly type: 'SESSION' | 'LOCAL' | 'NONE' | 'COOKIE' };
}
