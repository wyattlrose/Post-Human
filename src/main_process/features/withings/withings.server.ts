import * as http from 'node:http';

export interface WithingsConfig {
    clientId: string;
    clientSecret: string;
    apiEndpoint: string;
    callbackUrl: string;
    scope: string;
}

export interface WithingsToken {
    userid: string | number;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
}

export interface WithingsMeasure {
    value: number;
    type: number;
    unit: number;
    algo?: number;
    fm?: number;
    position?: number;
}

export interface WithingsMeasureGroup {
    grpid: number;
    attrib: number;
    date: number;
    created: number;
    modified: number;
    category: number;
    deviceid: string | null;
    hash_deviceid: string | null;
    measures: WithingsMeasure[];
    modelid: number | null;
    model: string | null;
    comment: string | null;
    timezone: string;
}

export interface WithingsMeasureBody {
    updatetime: number;
    timezone: string;
    measuregrps: WithingsMeasureGroup[];
    more?: number;
    offset?: number;
}

export interface WithingsMeasureResponse {
    status: number;
    error?: string;
    body?: WithingsMeasureBody;
}

export interface WithingsGetMeasParams {
    meastype?: number;
    meastypes?: string;
    category?: number;
    startdate?: number;
    enddate?: number;
    lastupdate?: number;
    offset?: number;
}

export interface WithingsAllMeasures {
    pages: number;
    measuregrpCount: number;
    updatetime?: number;
    timezone?: string;
    measuregrps: WithingsMeasureGroup[];
}

export class CallbackRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CallbackRequestError';
    }
}

export const buildAuthorizeUrl = (config: WithingsConfig, state: string): string => {
    const url = new URL('https://account.withings.com/oauth2_user/authorize2');
    url.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        scope: config.scope,
        redirect_uri: config.callbackUrl,
        state
    }).toString();
    return url.toString();
}

export const requestToken = async (config: WithingsConfig, params: Record<string, string>): Promise<WithingsToken> => {
    const body = new URLSearchParams({
        action: 'requesttoken',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...params
    });
    const endpoint = `${config.apiEndpoint.replace(/\/+$/, '')}/v2/oauth2`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    if (!response.ok) {
        throw new Error(`Withings token request failed with HTTP ${response.status}`);
    }

    const result = await response.json() as { status?: number; body?: WithingsToken; error?: string };
    if (result.status !== 0 || !result.body) {
        throw new Error(result.error || `Withings token request failed with status ${result.status}`);
    }
    return result.body;
}

export const getMeasures = async (config: WithingsConfig, accessToken: string, params: WithingsGetMeasParams): Promise<WithingsMeasureResponse> => {
    const endpoint = `${config.apiEndpoint.replace(/\/+$/, '')}/measure`;
    const body = new URLSearchParams({ action: 'getmeas' });
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) body.set(key, String(value));
    }
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });
    if (!response.ok) {
        throw new Error(`Withings measure request failed with HTTP ${response.status}`);
    }
    return await response.json() as WithingsMeasureResponse;
}

export const getAllMeasures = async (config: WithingsConfig, accessToken: string, params: WithingsGetMeasParams): Promise<WithingsAllMeasures> => {
    const maxPages = 1000;
    const measuregrps: WithingsMeasureGroup[] = [];
    const seenOffsets = new Set<number>();
    let requestOffset: number | undefined;
    let pages = 0;
    let updatetime: number | undefined;
    let timezone: string | undefined;

    while (true) {
        const pageParams: WithingsGetMeasParams = {...params};
        if (requestOffset) pageParams.offset = requestOffset;

        const result = await getMeasures(config, accessToken, pageParams);
        pages++;

        if (result.status !== 0) {
            throw new Error(result.error || `Withings measure request failed with status ${result.status}`);
        }
        if (!result.body) {
            throw new Error('Withings measure response did not include a body.');
        }

        const body = result.body;
        if (Array.isArray(body.measuregrps)) measuregrps.push(...body.measuregrps);
        if (updatetime === undefined) updatetime = body.updatetime;
        if (timezone === undefined) timezone = body.timezone;

        if (!body.more) break;
        const nextOffset = body.offset;
        if (typeof nextOffset !== 'number' || !Number.isFinite(nextOffset) || nextOffset === requestOffset || seenOffsets.has(nextOffset)) break;
        if (pages >= maxPages) {
            throw new Error(`Withings measure pagination exceeded the ${maxPages}-page limit.`);
        }
        seenOffsets.add(nextOffset);
        requestOffset = nextOffset;
    }

    return {pages, measuregrpCount: measuregrps.length, updatetime, timezone, measuregrps};
}

// Withings measure type 1 is weight in KG, sent as value * 10^unit
export const extractWeights = (measuregrps: WithingsMeasureGroup[]): { weight: number; date: number }[] => {
    const weights: { weight: number; date: number }[] = [];
    for (const group of measuregrps) {
        if (typeof group.date !== 'number' || !Array.isArray(group.measures)) continue;
        const measure = group.measures.find(m => m.type === 1 && typeof m.value === 'number' && typeof m.unit === 'number');
        if (!measure) continue;
        // Parsing the decimal string avoids float artifacts such as 81807 * 10 ** -3 = 81.80699999999999
        const weight = Number(`${measure.value}e${measure.unit}`);
        if (Number.isFinite(weight)) weights.push({ weight, date: group.date });
    }
    return weights;
}

export const startCallbackServer = (options: {
    port: number;
    path: string;
    onCallback: (params: URLSearchParams) => Promise<void> | void;
}): http.Server => {
    const server = http.createServer((request, response) => {
        const requestUrl = new URL(request.url || '/', 'http://localhost');
        if (requestUrl.pathname !== options.path) {
            response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<!doctype html><html><body><h1>Not found</h1></body></html>');
            return;
        }
        if (request.method !== 'GET') {
            response.writeHead(405, { Allow: 'GET', 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<!doctype html><html><body><h1>Method not allowed</h1></body></html>');
            return;
        }
        if (requestUrl.searchParams.has('error') || !requestUrl.searchParams.get('code')) {
            response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<!doctype html><html><body><h1>Withings authorization failed</h1><p>The authorization was declined or no code was provided.</p></body></html>');
            return;
        }

        Promise.resolve().then(() => options.onCallback(requestUrl.searchParams)).then(() => {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<!doctype html><html><body><h1>Withings connected</h1><p>You can close this window.</p></body></html>');
        }).catch(error => {
            const isInvalidRequest = error instanceof CallbackRequestError;
            const status = isInvalidRequest ? 400 : 500;
            const message = isInvalidRequest ? error.message : 'Unable to complete Withings authorization.';
            const safeMessage = message.replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[character] || character));
            response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(`<!doctype html><html><body><h1>Withings authorization failed</h1><p>${safeMessage}</p></body></html>`);
        });
    });
    server.listen(options.port, 'localhost');
    return server;
}