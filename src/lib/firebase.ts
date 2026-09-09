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

// Cache token in memory / sessionStorage for active session
let cachedAccessToken: string | null = null;
let customUser: { displayName?: string; email?: string; photoURL?: string; uid: string } | null = null;
let isSigningIn = false;

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
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else if (customUser) {
      if (onAuthSuccess) {
        onAuthSuccess(customUser as any, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
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

export const googleSignIn = async (options?: { useGsiOnly?: boolean }): Promise<{ user: User; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Sign in is already in progress.');
  }

  isSigningIn = true;

  try {
    // If running on an external domain like Vercel and not in preview, or if requested, try GSI or Firebase
    if (!options?.useGsiOnly) {
      try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);

        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          return { user: result.user, accessToken: cachedAccessToken };
        }
      } catch (firebaseErr: any) {
        console.warn('Firebase popup sign-in encountered an error:', firebaseErr?.code || firebaseErr);

        // If domain is unauthorized in Firebase (e.g. deployed on Vercel), fall back to GSI
        const isUnauthorizedDomain =
          firebaseErr?.code === 'auth/unauthorized-domain' ||
          (firebaseErr?.message && firebaseErr.message.includes('unauthorized-domain'));

        if (!isUnauthorizedDomain && firebaseErr?.code === 'auth/popup-closed-by-user') {
          throw new Error('Sign-in window was closed before completing. Please try again.');
        }

        // Try GSI directly
        console.log('Attempting Google Identity Services (GSI) direct authorization fallback...');
        const token = await requestGsiToken();
        if (token) {
          cachedAccessToken = token;
          const profile = await fetchGoogleUserProfile(token);
          customUser = profile;
          return { user: profile as any, accessToken: token };
        }

        // If both failed, provide informative error
        if (isUnauthorizedDomain) {
          const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'your-vercel-domain';
          throw new Error(
            `Vercel Domain (${currentDomain}) is not authorized in Firebase Auth.\n\n` +
            `Fix options:\n` +
            `1. In Firebase Console > Authentication > Settings > Authorized domains, add "${currentDomain}".\n` +
            `2. Or enter a Google OAuth Client ID or paste your OAuth token below.`
          );
        }

        throw firebaseErr;
      }
    }

    // Direct GSI token request
    const token = await requestGsiToken();
    if (token) {
      cachedAccessToken = token;
      const profile = await fetchGoogleUserProfile(token);
      customUser = profile;
      return { user: profile as any, accessToken: token };
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

export const setManualAccessToken = (token: string) => {
  cachedAccessToken = token.trim();
  if (!customUser && cachedAccessToken) {
    customUser = {
      displayName: 'Connected via OAuth Token',
      email: '',
      uid: 'manual-token-user',
    };
  }
};

export const getAccessToken = (): string | null => {
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
};
