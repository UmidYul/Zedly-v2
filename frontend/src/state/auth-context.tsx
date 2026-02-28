import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  LoginMethodsPrompt,
  LoginMethodsResponse,
  PasswordChangeRequired,
  ApiError,
  AuthTokens,
  MeResponse,
  PatchMePayload,
  TelegramNotConnected,
  authChangeFirstPassword,
  authLogin,
  authLogout,
  authLogoutAll,
  authRefresh,
  authTelegram,
  usersConnectGoogle,
  usersConnectTelegram,
  usersGetLoginMethods,
  usersPatchMe,
  usersMe
} from "../lib/api";

export interface SessionState {
  tokens: AuthTokens;
  me: MeResponse;
}

interface AuthContextShape {
  session: SessionState | null;
  isBootstrapping: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (login: string, password: string) => Promise<PasswordChangeRequired | null>;
  completeFirstPasswordChange: (challengeToken: string, newPassword: string, repeatPassword: string) => Promise<LoginMethodsPrompt>;
  signInTelegram: (authData: Record<string, string>) => Promise<TelegramNotConnected | null>;
  tryRefresh: () => Promise<void>;
  reloadMe: () => Promise<void>;
  getLoginMethods: () => Promise<LoginMethodsResponse | null>;
  connectGoogleLogin: () => Promise<LoginMethodsResponse | null>;
  connectTelegramLogin: () => Promise<LoginMethodsResponse | null>;
  updateProfile: (payload: PatchMePayload) => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextShape | null>(null);

async function buildSession(tokens: AuthTokens): Promise<SessionState> {
  const me = await usersMe(tokens.access_token);
  return { tokens, me };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const tryRefresh = useCallback(async () => {
    try {
      const tokens = await authRefresh();
      const next = await buildSession(tokens);
      setSession(next);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession(null);
        return;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await tryRefresh();
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Не удалось восстановить сессию");
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [tryRefresh]);

  const signIn = useCallback(async (login: string, password: string): Promise<PasswordChangeRequired | null> => {
    const response = await authLogin(login, password);
    if ("status" in response && response.status === "password_change_required") {
      return response;
    }
    const next = await buildSession(response as AuthTokens);
    setSession(next);
    setError(null);
    return null;
  }, []);

  const completeFirstPasswordChange = useCallback(
    async (challengeToken: string, newPassword: string, repeatPassword: string): Promise<LoginMethodsPrompt> => {
      const response = await authChangeFirstPassword(challengeToken, newPassword, repeatPassword);
      const next = await buildSession(response);
      setSession(next);
      setError(null);
      return response;
    },
    []
  );

  const signInTelegram = useCallback(async (authData: Record<string, string>): Promise<TelegramNotConnected | null> => {
    const response = await authTelegram(authData);
    if ("status" in response) {
      return response as TelegramNotConnected;
    }
    const next = await buildSession(response as AuthTokens);
    setSession(next);
    setError(null);
    return null;
  }, []);

  const reloadMe = useCallback(async () => {
    if (!session) {
      return;
    }
    const me = await usersMe(session.tokens.access_token);
    setSession({ tokens: session.tokens, me });
  }, [session]);

  const updateProfile = useCallback(
    async (payload: PatchMePayload) => {
      if (!session) {
        return;
      }
      const me = await usersPatchMe(session.tokens.access_token, payload);
      setSession({ tokens: session.tokens, me });
      setError(null);
    },
    [session]
  );

  const getLoginMethods = useCallback(async (): Promise<LoginMethodsResponse | null> => {
    if (!session) {
      return null;
    }
    return usersGetLoginMethods(session.tokens.access_token);
  }, [session]);

  const connectGoogleLogin = useCallback(async (): Promise<LoginMethodsResponse | null> => {
    if (!session) {
      return null;
    }
    const result = await usersConnectGoogle(session.tokens.access_token);
    await reloadMe();
    return result;
  }, [session, reloadMe]);

  const connectTelegramLogin = useCallback(async (): Promise<LoginMethodsResponse | null> => {
    if (!session) {
      return null;
    }
    const result = await usersConnectTelegram(session.tokens.access_token);
    await reloadMe();
    return result;
  }, [session, reloadMe]);

  const signOut = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      await authLogout(session.tokens.access_token);
    } finally {
      setSession(null);
    }
  }, [session]);

  const signOutAll = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      await authLogoutAll(session.tokens.access_token);
    } finally {
      setSession(null);
    }
  }, [session]);

  const value = useMemo<AuthContextShape>(
    () => ({
      session,
      isBootstrapping,
      error,
      clearError,
      signIn,
      completeFirstPasswordChange,
      signInTelegram,
      tryRefresh,
      reloadMe,
      getLoginMethods,
      connectGoogleLogin,
      connectTelegramLogin,
      updateProfile,
      signOut,
      signOutAll
    }),
    [
      session,
      isBootstrapping,
      error,
      clearError,
      signIn,
      completeFirstPasswordChange,
      signInTelegram,
      tryRefresh,
      reloadMe,
      getLoginMethods,
      connectGoogleLogin,
      connectTelegramLogin,
      updateProfile,
      signOut,
      signOutAll
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
