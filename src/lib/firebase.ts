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
const USERINFO_PROFILE_SCOPE = 'https://www.googleapis.com/auth/userinfo.profile';
const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const ALL_SCOPES = `${YOUTUBE_UPLOAD_SCOPE} ${USERINFO_PROFILE_SCOPE} ${USERINFO_EMAIL_SCOPE}`;

const provider = new GoogleAuthProvider();
provider.addScope(YOUTUBE_UPLOAD_SCOPE);
provider.addScope(USERINFO_PROFILE_SCOPE);
provider.addScope(USERINFO_EMAIL_SCOPE);
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

// Cache token in memory & localStorage for active session
const STORAGE_TOKEN_KEY = 'hockey_youtube_oauth_token';
const STORAGE_USER_KEY = 'hockey_youtube_oauth_user';

let cachedAccessToken: string | null = null;
let customUser: { displayName?: string; email?: string; photoURL?: string; uid: string } | null = null;
let isSigningIn = false;

// Initialize from storage
if (typeof window !== 'undefined') {
  try {
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY) || sessionStorage.getItem(STORAGE_TOKEN_KEY);
    if (savedToken && savedToken.trim()) {
      cachedAccessToken = savedToken.trim();
      const savedUser = localStorage.getItem(STORAGE_USER_KEY);
      if (savedUser) {
        customUser = JSON.parse(savedUser);
      } else {
        customUser = {
          displayName: 'Connected YouTube Account',
          email: '',
          uid: 'saved-oauth-user',
        };
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
}

export const isExternalDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('vercel.app') || (!host.includes('run.app') && host !== 'localhost' && host !== '127.0.0.1');
};

export const hasCustomClientId = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('custom_google_client_id');
    if (stored && stored.trim()) return true;
  }
  return Boolean((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID);
};

export const getStoredClientId = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('custom_google_client_id');
    if (stored && stored.trim()) return stored.trim();
  }
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || firebaseConfig.oAuthClientId || '';
};

export const setStoredClientId = (clientId: string) => {
  if (typeof window !== 'undefined') {
    if (clientId.trim()) {
      localStorage.setItem('custom_google_client_id', clientId.trim());
    } else {
      localStorage.removeItem('custom_google_client_id');
    }
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void,
) => {
  // If we already have a persisted token from storage, notify immediately
  if (cachedAccessToken && customUser && onAuthSuccess) {
    onAuthSuccess(customUser as any, cachedAccessToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else if (customUser && cachedAccessToken) {
      if (onAuthSuccess) {
        onAuthSuccess(customUser as any, cachedAccessToken);
      }
    } else {
      if (!cachedAccessToken) {
        if (onAuthFailure) {
          onAuthFailure();
        }
      }
    }
  });
};

/**
 * Fetch basic user profile when authenticated via Google Identity Services directly
 */
async function fetchGoogleUserProfile(token: string) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        displayName: data.name || data.email,
        email: data.email || '',
        photoURL: data.picture || '',
        uid: data.sub || 'google-user',
      };
    }
  } catch (err) {
    console.warn('Could not fetch user profile:', err);
  }
  return {
    displayName: 'Google Account',
    email: '',
    uid: 'google-user',
  };
}

export const googleSignIn = async (options?: { useGsiOnly?: boolean; clientId?: string }): Promise<{ user: User; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Sign in is already in progress.');
  }

  isSigningIn = true;

  try {
    const customCid = options?.clientId || (hasCustomClientId() ? getStoredClientId() : undefined);

    // On external domains (e.g. Vercel) without a custom Google Client ID:
    // Google's OAuth server will block popups with "Access blocked: Authorization Error (origin_mismatch)"
    // because the default AI Studio client ID is locked to AI Studio preview domains.
    if (isExternalDomain() && !customCid) {
      throw new Error(
        `Google blocks sign-in popups on external domains (${window.location.hostname}) with "Access blocked: Authorization Error".\n\n` +
        `To connect on Vercel:\n` +
        `1. Recommended: Use Option 1 to paste an OAuth Token from Google Playground (0-setup, 30s).\n` +
        `2. Or enter your own Google Cloud OAuth Web Client ID.`
      );
    }

    // If a custom client ID is provided or useGsiOnly requested, use GSI directly
    if (options?.useGsiOnly || customCid) {
      const token = await requestGsiToken(customCid);
      if (token) {
        cachedAccessToken = token;
        const profile = await fetchGoogleUserProfile(token);
        customUser = profile;
        setManualAccessToken(token, profile);
        return { user: profile as any, accessToken: token };
      }
    }

    // Standard Firebase popup sign-in (for development or authorized domains)
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        setManualAccessToken(credential.accessToken, {
          displayName: result.user.displayName || result.user.email || 'YouTube User',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
        });
        return { user: result.user, accessToken: cachedAccessToken };
      }
    } catch (firebaseErr: any) {
      console.warn('Firebase popup sign-in encountered an error:', firebaseErr?.code || firebaseErr);

      if (firebaseErr?.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in window was closed before completing. If you saw "Access blocked: Authorization Error", please use the OAuth Token method.');
      }

      // Try GSI directly if client ID is available
      const token = await requestGsiToken(customCid);
      if (token) {
        cachedAccessToken = token;
        const profile = await fetchGoogleUserProfile(token);
        customUser = profile;
        setManualAccessToken(token, profile);
        return { user: profile as any, accessToken: token };
      }

      throw firebaseErr;
    }

    if (!cachedAccessToken) {
      throw new Error('Google Sign-In completed, but YouTube upload scope was not granted.');
    }

    return { user: (customUser || auth.currentUser) as any, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const requestGsiToken = (customClientId?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window environment not available.'));
      return;
    }

    const gAccounts = (window as any).google?.accounts?.oauth2;
    if (!gAccounts) {
      reject(new Error('Google Identity Services script is loading. Please wait 2 seconds and try again.'));
      return;
    }

    const clientId = customClientId || getStoredClientId();
    if (!clientId) {
      reject(new Error('Missing Google Client ID. Please configure your Google Client ID.'));
      return;
    }

    try {
      const client = gAccounts.initTokenClient({
        client_id: clientId,
        scope: ALL_SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
          } else if (tokenResponse.access_token) {
            cachedAccessToken = tokenResponse.access_token;
            resolve(tokenResponse.access_token);
          } else {
            reject(new Error('No access token returned by Google Identity Services.'));
          }
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(new Error(`Failed to initialize Google OAuth: ${err?.message || err}`));
    }
  });
};

export const setManualAccessToken = (
  token: string,
  userProfile?: { displayName?: string; email?: string; photoURL?: string },
) => {
  const clean = token.trim();
  cachedAccessToken = clean || null;

  if (clean) {
    customUser = {
      displayName: userProfile?.displayName || customUser?.displayName || 'Connected via YouTube Token',
      email: userProfile?.email || customUser?.email || '',
      photoURL: userProfile?.photoURL || customUser?.photoURL || '',
      uid: 'manual-token-user',
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_TOKEN_KEY, clean);
        sessionStorage.setItem(STORAGE_TOKEN_KEY, clean);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(customUser));
      } catch (e) {}
    }
  } else {
    customUser = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
      } catch (e) {}
    }
  }
};

export const getAccessToken = (): string | null => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    try {
      cachedAccessToken = localStorage.getItem(STORAGE_TOKEN_KEY) || sessionStorage.getItem(STORAGE_TOKEN_KEY) || null;
    } catch (e) {}
  }
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    // Ignore if not signed in via Firebase
  }
  cachedAccessToken = null;
  customUser = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch (e) {}
  }
};
