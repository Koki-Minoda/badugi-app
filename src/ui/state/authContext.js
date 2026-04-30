import { createContext } from "react";

export const defaultAuthState = {
  isAuthenticated: false,
  accessToken: null,
  tokenType: null,
  user: null,
};

export const AuthContext = createContext({
  authState: defaultAuthState,
  loginSuccess: () => {},
  logout: () => {},
  hydrateFromStorage: () => {},
  validateToken: async () => {},
});
