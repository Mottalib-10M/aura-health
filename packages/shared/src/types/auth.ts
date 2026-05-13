// ---------------------------------------------------------------------------
// Authentication & Authorization Domain Types
// ---------------------------------------------------------------------------

/**
 * System-wide user roles following the principle of least privilege.
 */
export type UserRole =
  | 'patient'
  | 'doctor'
  | 'nurse'
  | 'pharmacist'
  | 'lab_technician'
  | 'admin'
  | 'institution_admin'
  | 'regional_health_officer'
  | 'epidemiologist'
  | 'system_admin'
  | 'auditor';

/**
 * Authentication method used for the current session.
 */
export type AuthMethod =
  | 'password'
  | 'biometric_fingerprint'
  | 'biometric_face'
  | 'biometric_iris'
  | 'webauthn'
  | 'sso_oauth2'
  | 'sso_saml'
  | 'magic_link'
  | 'otp_sms'
  | 'otp_email';

/**
 * Multi-factor authentication (MFA) method.
 */
export type MfaMethod = 'totp' | 'sms' | 'email' | 'webauthn' | 'biometric';

/**
 * Account status.
 */
export type AccountStatus = 'active' | 'suspended' | 'locked' | 'pending_verification' | 'deactivated';

// ---- WebAuthn ---------------------------------------------------------------

/**
 * WebAuthn credential registration options sent to the client.
 */
export interface WebAuthnRegistrationOptions {
  challenge: string; // base64url-encoded
  rp: {
    id: string;
    name: string;
  };
  user: {
    id: string; // base64url-encoded
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number; // COSE algorithm identifier
  }>;
  timeout: number;
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise';
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey: 'discouraged' | 'preferred' | 'required';
    requireResidentKey: boolean;
    userVerification: 'discouraged' | 'preferred' | 'required';
  };
  excludeCredentials?: Array<{
    type: 'public-key';
    id: string; // base64url-encoded
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
  }>;
}

/**
 * WebAuthn credential registration response from the client.
 */
export interface WebAuthnRegistrationResponse {
  id: string;
  rawId: string; // base64url-encoded
  type: 'public-key';
  response: {
    attestationObject: string; // base64url-encoded
    clientDataJSON: string; // base64url-encoded
  };
  authenticatorAttachment?: 'platform' | 'cross-platform';
}

/**
 * WebAuthn authentication (assertion) options sent to the client.
 */
export interface WebAuthnAuthenticationOptions {
  challenge: string; // base64url-encoded
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{
    type: 'public-key';
    id: string; // base64url-encoded
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
  }>;
  userVerification: 'discouraged' | 'preferred' | 'required';
}

/**
 * WebAuthn authentication response from the client.
 */
export interface WebAuthnAuthenticationResponse {
  id: string;
  rawId: string; // base64url-encoded
  type: 'public-key';
  response: {
    authenticatorData: string; // base64url-encoded
    clientDataJSON: string; // base64url-encoded
    signature: string; // base64url-encoded
    userHandle?: string; // base64url-encoded
  };
}

/**
 * Stored WebAuthn credential record.
 */
export interface WebAuthnCredential {
  id: string;
  credential_id: string; // base64url-encoded
  public_key: string; // base64url-encoded COSE key
  user_id: string;
  sign_count: number;
  device_name?: string;
  authenticator_type: 'platform' | 'cross-platform';
  transports: Array<'usb' | 'nfc' | 'ble' | 'internal'>;
  created_at: string; // ISO 8601 datetime
  last_used_at?: string; // ISO 8601 datetime
  is_active: boolean;
}

// ---- Biometric Authentication -----------------------------------------------

/**
 * Biometric template enrollment request.
 */
export interface BiometricEnrollmentRequest {
  user_id: string;
  biometric_type: 'fingerprint' | 'face' | 'iris';
  template_data: string; // base64-encoded biometric template
  device_id: string;
  liveness_check_passed: boolean;
  quality_score: number; // 0-100
}

/**
 * Biometric verification request.
 */
export interface BiometricVerificationRequest {
  user_id: string;
  biometric_type: 'fingerprint' | 'face' | 'iris';
  template_data: string; // base64-encoded
  device_id: string;
  liveness_check_passed: boolean;
}

/**
 * Biometric verification result.
 */
export interface BiometricVerificationResult {
  verified: boolean;
  confidence_score: number; // 0-1
  match_threshold: number; // 0-1
  attempts_remaining: number;
  locked_until?: string; // ISO 8601 datetime, if too many failed attempts
}

// ---- Session & Token --------------------------------------------------------

/**
 * User session record.
 */
export interface UserSession {
  session_id: string;
  user_id: string;
  role: UserRole;
  auth_method: AuthMethod;
  mfa_verified: boolean;
  ip_address: string;
  user_agent: string;
  device_fingerprint?: string;
  institution_id?: string; // scoped to institution if applicable
  permissions: string[];
  issued_at: string; // ISO 8601 datetime
  expires_at: string; // ISO 8601 datetime
  last_activity_at: string; // ISO 8601 datetime
  is_active: boolean;
}

/**
 * JWT token payload (claims) for Aura Health.
 */
export interface AuraTokenPayload {
  sub: string; // user ID
  role: UserRole;
  institution_id?: string;
  permissions: string[];
  auth_method: AuthMethod;
  mfa_verified: boolean;
  session_id: string;
  iat: number; // issued at (unix timestamp)
  exp: number; // expiration (unix timestamp)
  iss: string; // issuer
  aud: string; // audience
}

/**
 * Token pair returned after successful authentication.
 */
export interface AuthTokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // seconds
  scope: string;
}

// ---- Login / Registration ---------------------------------------------------

/**
 * Login request payload.
 */
export interface LoginRequest {
  email?: string;
  phone?: string;
  password?: string;
  biometric?: BiometricVerificationRequest;
  webauthn?: WebAuthnAuthenticationResponse;
  otp_code?: string;
  mfa_code?: string;
  device_fingerprint?: string;
}

/**
 * Login response payload.
 */
export interface LoginResponse {
  success: boolean;
  tokens?: AuthTokenPair;
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
    institution_id?: string;
  };
  mfa_required?: boolean;
  mfa_methods?: MfaMethod[];
  error?: string;
}

/**
 * Audit log entry for authentication events.
 */
export interface AuthAuditEntry {
  id: string;
  user_id: string;
  event_type:
    | 'login_success'
    | 'login_failure'
    | 'logout'
    | 'token_refresh'
    | 'password_change'
    | 'mfa_enabled'
    | 'mfa_disabled'
    | 'biometric_enrolled'
    | 'webauthn_registered'
    | 'account_locked'
    | 'account_unlocked'
    | 'permission_changed';
  auth_method?: AuthMethod;
  ip_address: string;
  user_agent: string;
  metadata?: Record<string, unknown>;
  timestamp: string; // ISO 8601 datetime
}
