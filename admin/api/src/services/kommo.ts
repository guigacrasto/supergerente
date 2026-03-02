import axios, { AxiosInstance } from "axios";
import qs from "qs";
import { loadTokens, saveTokens } from "../shared/index.js";
import type { TeamConfig, TeamKey } from "../shared/index.js";

export class KommoService {
  public client: AxiosInstance;
  private config: TeamConfig;
  private currentAccessToken: string;
  private team: TeamKey;

  constructor(config: TeamConfig, team: TeamKey) {
    this.config = config;
    this.team = team;
    this.currentAccessToken = config.accessToken ?? "";
    this.client = axios.create({
      baseURL: `https://${config.subdomain}.kommo.com/api/v4`,
      timeout: 15_000,
      headers: {
        "Content-Type": "application/json",
      },
      paramsSerializer: {
        serialize: (params) =>
          qs.stringify(params, { arrayFormat: "brackets" }),
      },
    });

    this.setAccessToken(this.currentAccessToken);

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retried) {
          original._retried = true;
          try {
            const newToken = await this.refreshAccessToken();
            original.headers["Authorization"] = `Bearer ${newToken}`;
            return this.client(original);
          } catch (refreshErr) {
            console.error(
              `[KommoService:${this.team}] Token refresh failed:`,
              refreshErr
            );
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /** Called once on startup: loads the latest token from Supabase if available */
  public async loadStoredToken(): Promise<void> {
    try {
      const stored = await loadTokens(this.team);
      if (
        stored?.accessToken &&
        stored.accessToken !== this.currentAccessToken
      ) {
        console.log(
          `[KommoService:${this.team}] Using stored access token from Supabase`
        );
        this.setAccessToken(stored.accessToken);
      }
    } catch (e) {
      console.warn(
        `[KommoService:${this.team}] Could not load stored token, using env token:`,
        e
      );
    }
  }

  public setAccessToken(token: string): void {
    this.currentAccessToken = token;
    this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  /** Exchange a refresh_token for a new access_token + refresh_token */
  public async refreshAccessToken(): Promise<string> {
    const stored = await loadTokens(this.team);
    if (!stored?.refreshToken) {
      throw new Error(
        `[${this.team}] No refresh token available. Please re-authorize via the admin panel.`
      );
    }

    console.log(`[KommoService:${this.team}] Refreshing access token...`);
    const response = await axios.post(
      `https://${this.config.subdomain}.kommo.com/oauth2/access_token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
        redirect_uri: this.config.redirectUri,
      }
    );

    const { access_token, refresh_token, expires_in, server_time } =
      response.data;
    const expiresAt =
      (server_time || Math.floor(Date.now() / 1000)) + (expires_in || 86400);
    await saveTokens(this.team, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    });
    this.setAccessToken(access_token);
    console.log(
      `[KommoService:${this.team}] Token refreshed and saved. Expires at ${new Date(expiresAt * 1000).toISOString()}`
    );
    return access_token;
  }

  /** Refresh the token proactively if it expires within 2 hours (or has no recorded expiry) */
  public async proactiveRefresh(): Promise<void> {
    try {
      const stored = await loadTokens(this.team);
      if (!stored?.refreshToken) {
        console.warn(
          `[KommoService:${this.team}] Proactive refresh skipped: no refresh token stored`
        );
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const twoHours = 2 * 60 * 60;
      if (!stored.expiresAt || stored.expiresAt - now < twoHours) {
        const hoursLeft = stored.expiresAt
          ? Math.round((stored.expiresAt - now) / 3600)
          : NaN;
        console.log(
          `[KommoService:${this.team}] Proactive refresh triggered (${isNaN(hoursLeft) ? "expiry unknown" : `${hoursLeft}h left`})`
        );
        await this.refreshAccessToken();
      } else {
        const hoursLeft = Math.round((stored.expiresAt - now) / 3600);
        console.log(
          `[KommoService:${this.team}] Token healthy — ~${hoursLeft}h remaining, no refresh needed`
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `[KommoService:${this.team}] Proactive refresh failed:`,
        message
      );
    }
  }

  /** Exchange an authorization code for access_token + refresh_token (OAuth step 2) */
  public async exchangeAuthCode(
    code: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await axios.post(
      `https://${this.config.subdomain}.kommo.com/oauth2/access_token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
      }
    );

    const { access_token, refresh_token, expires_in, server_time } =
      response.data;
    const expiresAt =
      (server_time || Math.floor(Date.now() / 1000)) + (expires_in || 86400);
    await saveTokens(this.team, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    });
    this.setAccessToken(access_token);
    console.log(
      `[KommoService:${this.team}] Authorization code exchanged, tokens saved. Expires at ${new Date(expiresAt * 1000).toISOString()}`
    );
    return { accessToken: access_token, refreshToken: refresh_token };
  }

  public async getPipelines(): Promise<Array<{ id: number; name: string }>> {
    try {
      const response = await this.client.get("/leads/pipelines");
      return response.data?._embedded?.pipelines || [];
    } catch (error) {
      console.error("Error fetching pipelines:", error);
      throw error;
    }
  }
}
