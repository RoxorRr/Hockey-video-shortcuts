import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

const provider = new GoogleAuthProvider();
provider.addScope(YOUTUBE_UPLOAD_SCOPE);
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

// Cache token strictly in memory per security guidelines
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    }

    // If credential.accessToken was not returned directly by popup (can happen in certain session states),
    // request token via Google Identity Services token client
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      const token = await requestGsiToken();
      if (token) {
        cachedAccessToken = token;
        return { user: result.user, accessToken: token };
      }
    }

    // Try reading STS or return error
    if (!cachedAccessToken) {
      throw new Error('Google Sign-In completed, but YouTube upload scope token was not returned. Please grant YouTube upload permissions.');
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const requestGsiToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library not loaded.'));
      return;
    }

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: firebaseConfig.oAuthClientId,
      scope: YOUTUBE_UPLOAD_SCOPE,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error_description || tokenResponse.error));
        } else if (tokenResponse.access_token) {
          cachedAccessToken = tokenResponse.access_token;
          resolve(tokenResponse.access_token);
        } else {
          reject(new Error('No access token returned.'));
        }
      },
    });

    client.requestAccessToken();
  });
};

export const setManualAccessToken = (token: string) => {
  cachedAccessToken = token.trim();
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
