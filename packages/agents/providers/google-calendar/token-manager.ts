import type { SupabaseClient } from '@supabase/supabase-js';
import type { OAuthTokens, OAuthStateEncrypted } from '@flow/types';
import { decryptCalendarTokens, rotateCalendarTokens } from '@flow/db/vault/calendar-tokens';
import type { CalendarProvider } from '../calendar-provider';

const TOKEN_EXPIRY_BUFFER_MS = 60_000; // refresh 1 minute before expiry

export class CalendarTokenManager {
  private provider: CalendarProvider;
  private maxFailures: number;

  constructor(provider: CalendarProvider, maxFailures = 3) {
    this.provider = provider;
    this.maxFailures = maxFailures;
  }

  /**
   * Decrypt tokens, check expiry, and refresh if needed.
   * Returns valid tokens. If a refresh occurred, the encrypted state is also returned
   * so the caller can persist the rotated state.
   */
  async getValidTokens(
    calendarId: string,
    encryptedState: OAuthStateEncrypted,
  ): Promise<{ tokens: OAuthTokens; encrypted?: OAuthStateEncrypted }> {
    const tokens = decryptCalendarTokens(encryptedState);
    const now = Date.now();

    if (tokens.expiryDate > now + TOKEN_EXPIRY_BUFFER_MS) {
      return { tokens };
    }

    // Token is expired or about to expire — refresh
    const newTokens = await this.provider.refreshToken(tokens.refreshToken);
    const newEncrypted = rotateCalendarTokens(encryptedState, newTokens);
    void calendarId; // caller is responsible for persisting the rotated state
    return { tokens: newTokens, encrypted: newEncrypted };
  }

  /**
   * Decrypt, refresh via provider, rotate the encrypted state,
   * persist to DB, and reset consecutive_refresh_failures to 0.
   */
  async refreshAndStore(
    supabase: SupabaseClient,
    calendarId: string,
    encryptedState: OAuthStateEncrypted,
  ): Promise<{ tokens: OAuthTokens; encrypted: OAuthStateEncrypted }> {
    const tokens = decryptCalendarTokens(encryptedState);
    const newTokens = await this.provider.refreshToken(tokens.refreshToken);
    const newEncrypted = rotateCalendarTokens(encryptedState, newTokens);

    const { error } = await supabase
      .from('client_calendars')
      .update({
        oauth_state: newEncrypted as unknown as Record<string, unknown>,
        consecutive_refresh_failures: 0,
      })
      .eq('id', calendarId);

    if (error) {
      throw Object.assign(
        new Error(`Failed to store refreshed calendar tokens: ${error.message}`),
        { code: 'CALENDAR_CONNECTION_FAILED' as const, statusCode: 500 },
      );
    }

    return { tokens: newTokens, encrypted: newEncrypted };
  }

  /**
   * Atomically increment consecutive_refresh_failures. If the count reaches maxFailures,
   * set sync_status to 'disconnected' so the calendar is no longer synced.
   * Uses a Postgres function via RPC for atomic increment.
   */
  async handleRefreshFailure(
    supabase: SupabaseClient,
    calendarId: string,
    _currentFailures: number,
  ): Promise<void> {
    const { data, error: rpcError } = await supabase
      .rpc('increment_calendar_refresh_failures', {
        p_calendar_id: calendarId,
        p_max_failures: this.maxFailures,
      });

    if (rpcError || data === null) {
      throw Object.assign(
        new Error(`Failed to increment refresh failure count: ${rpcError?.message ?? 'no row returned'}`),
        { code: 'CALENDAR_CONNECTION_FAILED' as const, statusCode: 500 },
      );
    }
  }
}
