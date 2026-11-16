// A 401 from the API while a session existed means the session ended (idle timeout, revoked or expired).
// RequireSession reads the flag (pure, safe to render twice) when it redirects to the login page; the login page
// clears it once shown (P5). Signing out deliberately never sets it: logout does not produce a 401.
let expired = false;

export const markSessionExpired = (): void => { expired = true; };
export const isSessionExpired = (): boolean => expired;
export const clearSessionExpired = (): void => { expired = false; };
