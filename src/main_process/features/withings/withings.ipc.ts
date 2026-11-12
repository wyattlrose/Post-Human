import { ipcMain, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { getSettings, updateSetting } from '../settings/settings.js';
import { upsertBiometricWeights } from '../biometrics/biometrics.ipc.js';
import { buildAuthorizeUrl, CallbackRequestError, extractWeights, getAllMeasures, requestToken, startCallbackServer, WithingsConfig, WithingsToken } from './withings.server.js';
import type { Server } from 'node:http';
import type { WithingsFetchResult, WithingsStatus } from '../../../shared/types/index.js';

const DEFAULT_API_ENDPOINT = 'https://wbsapi.withings.net';
const WITHINGS_CALLBACK_URL = 'http://localhost:5000/withings';
const WITHINGS_SCOPE = 'user.metrics,user.activity';
const STATE_TTL = 10 * 60 * 1000;

interface PendingState {
    expiresAt: number;
    settle: (error?: Error) => void;
}

const pendingStates = new Map<string, PendingState>();
let callbackServer: Server | null = null;
let weightSyncPromise: Promise<WithingsFetchResult> | null = null;

const getConfig = (): WithingsConfig => {
    const oauth = getSettings().withings?.oauth;
    return {
        clientId: oauth?.client_id || '',
        clientSecret: oauth?.client_secret || '',
        apiEndpoint: oauth?.api_endpoint || DEFAULT_API_ENDPOINT,
        callbackUrl: WITHINGS_CALLBACK_URL,
        scope: WITHINGS_SCOPE
    };
}

const saveToken = (token: WithingsToken, refreshTokenFallback?: string) => {
    if (token.userid === undefined || token.userid === null) {
        throw new Error('Withings returned an incomplete token response.');
    }
    const userId = String(token.userid);
    const refreshToken = token.refresh_token || refreshTokenFallback;
    const expiresIn = Number(token.expires_in);
    if (!userId || !token.access_token || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw new Error('Withings returned an incomplete token response.');
    }
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const withingsSettings = getSettings().withings;
    updateSetting('withings', 'token', {
        ...withingsSettings?.token,
        user_id: userId,
        access_token: token.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt
    });
}

const handleCallback = async (params: URLSearchParams) => {
    const state = params.get('state');
    const pending = state ? pendingStates.get(state) : undefined;
    if (!state || !pending || pending.expiresAt < Date.now()) {
        if (state) pendingStates.delete(state);
        pending?.settle(new Error('The Withings authorization request expired.'));
        throw new CallbackRequestError('The authorization request expired or could not be verified. Please try again.');
    }
    pendingStates.delete(state);

    try {
        await exchangeCallbackCode(params);
        pending.settle();
    } catch (error) {
        pending.settle(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

const exchangeCallbackCode = async (params: URLSearchParams) => {
    const providerError = params.get('error');
    if (providerError) {
        throw new CallbackRequestError('Withings authorization was not approved.');
    }
    const code = params.get('code');
    if (!code) {
        throw new CallbackRequestError('The callback did not include an authorization code.');
    }

    const config = getConfig();
    const token = await requestToken(config, {
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.callbackUrl
    });
    saveToken(token);
}

// Opens the Withings consent page and resolves once the callback has stored a token
const authorize = async (): Promise<void> => {
    const config = getConfig();
    if (!config.clientId || !config.clientSecret) {
        throw new Error('Withings client_id and client_secret are not configured.');
    }
    if (!callbackServer?.listening) {
        throw new Error('The Withings callback server is not listening.');
    }

    const now = Date.now();
    for (const [pendingState, pending] of pendingStates) {
        if (pending.expiresAt < now) {
            pendingStates.delete(pendingState);
            pending.settle(new Error('The Withings authorization request expired.'));
        }
    }
    const state = randomBytes(32).toString('hex');
    const completion = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingStates.delete(state);
            reject(new Error('Timed out waiting for Withings authorization.'));
        }, STATE_TTL);
        pendingStates.set(state, {
            expiresAt: now + STATE_TTL,
            settle: error => {
                clearTimeout(timeout);
                if (error) reject(error);
                else resolve();
            }
        });
    });
    try {
        await shell.openExternal(buildAuthorizeUrl(config, state));
    } catch (error) {
        pendingStates.get(state)?.settle(new Error('Failed to open the Withings authorization page.'));
        pendingStates.delete(state);
    }
    return completion;
}

const syncWeight = (interactive: boolean): Promise<WithingsFetchResult> => {
    if (weightSyncPromise) return weightSyncPromise;

    weightSyncPromise = (async (): Promise<WithingsFetchResult> => {
        try {
            let accessToken = await getWithingsAccessToken();
            if (!accessToken && interactive) {
                await authorize();
                accessToken = await getWithingsAccessToken();
            }
            if (!accessToken) throw new Error('No Withings access token is available.');

            const storedLastUpdate = getSettings().withings?.lastUpdate;
            const lastUpdate = typeof storedLastUpdate === 'number' && Number.isFinite(storedLastUpdate) ? storedLastUpdate : 0;
            const startedAt = Math.floor(Date.now() / 1000);
            const response = await getAllMeasures(getConfig(), accessToken, {
                meastype: 1,
                category: 1,
                lastupdate: lastUpdate
            });
            const saved = upsertBiometricWeights(extractWeights(response.measuregrps));
            updateSetting('withings', 'lastUpdate', startedAt);
            return { success: true, response, saved };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    })().finally(() => {
        weightSyncPromise = null;
    });
    return weightSyncPromise;
}

export const registerWithingsIpc = () => {
    ipcMain.handle('withings-authorize', async () => {
        try {
            await authorize();
            return true;
        } catch (error) {
            console.error('Withings authorization failed:', error);
            return false;
        }
    });

    ipcMain.handle('withings-fetch-weight', async (): Promise<WithingsFetchResult> => {
        const result = await syncWeight(true);
        if (result.success) {
            console.log('All Withings weight data:\n', JSON.stringify(result.response, null, 2));
            console.log(`Saved ${result.saved ?? 0} Withings weight measurements to biometric_weight.`);
        } else {
            console.error('Failed to fetch Withings weight data:', result.error);
        }
        return result;
    });

    ipcMain.handle('withings-status', async (): Promise<WithingsStatus> => {
        const config = getConfig();
        const token = getSettings().withings?.token;
        return {
            configured: !!(config.clientId && config.clientSecret),
            listening: !!callbackServer?.listening,
            connected: !!token?.access_token,
            userId: token?.user_id
        };
    });
}

export const syncWithingsOnStartup = async (): Promise<void> => {
    const storedLastUpdate = getSettings().withings?.lastUpdate;
    const lastUpdate = typeof storedLastUpdate === 'number' && Number.isFinite(storedLastUpdate) ? storedLastUpdate : 0;
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    const currentHourStart = Math.floor(currentHour.getTime() / 1000);
    if (lastUpdate >= currentHourStart) {
        console.log("Withings Integration Startup: Data up to date, not syncing.")
        return;
    }
    console.log("Withings Integration Startup: Data ready for update, syncing.")
    const result = await syncWeight(false);
    if (!result.success) {
        console.error('Withings Integration Startup: Sync failed:', result.error);
    }
}

export const startWithingsCallbackServer = (): Server | null => {
    if (callbackServer?.listening) return callbackServer;
    try {
        const callbackUrl = new URL(getConfig().callbackUrl);
        const port = Number(callbackUrl.port || (callbackUrl.protocol === 'https:' ? 443 : 80));
        callbackServer = startCallbackServer({ port, path: callbackUrl.pathname, onCallback: handleCallback });
        callbackServer.on('error', error => {
            console.error(`Withings callback server could not listen on localhost:${port}:`, error);
        });
        return callbackServer;
    } catch (error) {
        console.error('Invalid Withings callback URL:', error);
        return null;
    }
}

export const closeWithingsCallbackServer = () => {
    callbackServer?.close();
    callbackServer = null;
}

export const getWithingsAccessToken = async (): Promise<string | null> => {
    const token = getSettings().withings?.token;
    if (!token?.access_token || !token.refresh_token || typeof token.expires_at !== 'number') return null;
    if (token.expires_at > Math.floor(Date.now() / 1000)) return token.access_token;

    try {
        const refreshedToken = await requestToken(getConfig(), {
            grant_type: 'refresh_token',
            refresh_token: token.refresh_token
        });
        saveToken(refreshedToken, token.refresh_token);
        return refreshedToken.access_token;
    } catch (error) {
        console.error('Failed to refresh the Withings access token:', error);
        return null;
    }
}