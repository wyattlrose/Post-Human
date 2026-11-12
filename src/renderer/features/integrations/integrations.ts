import type { WithingsOAuthSettingKey, WithingsOAuthSettings } from '../../../shared/types/index.js';

const oauthFields: { key: WithingsOAuthSettingKey; label: string }[] = [
    {key: 'client_id', label: 'Client ID'},
    {key: 'client_secret', label: 'Client Secret'},
    {key: 'api_endpoint', label: 'API Endpoint'}
];

let activeCleanup: (() => void) | null = null;

export async function loadIntegrations(): Promise<void> {
    activeCleanup?.();

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const template = document.getElementById('tpl-integrations-dashboard') as HTMLTemplateElement | null;
    const dashboard = template?.content.firstElementChild?.cloneNode(true);
    if (!(dashboard instanceof HTMLElement)) {
        console.error('Could not find the Integrations page template.');
        return;
    }

    const controller = new AbortController();
    let disposed = false;
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        controller.abort();
        dashboard.remove();
        if (activeCleanup === cleanup) activeCleanup = null;
    };
    activeCleanup = cleanup;

    const status = dashboard.querySelector<HTMLElement>('#integrations-status');
    if (!status) {
        cleanup();
        console.error('The Integrations page template is missing its status element.');
        return;
    }

    const inputs = oauthFields.map(field => ({
        field,
        input: dashboard.querySelector<HTMLInputElement>(`#withings-${field.key}`)
    }));
    if (inputs.some(({input}) => !input)) {
        cleanup();
        console.error('The Integrations page template is missing an OAuth field.');
        return;
    }

    mainContent.appendChild(dashboard);

    let oauth: WithingsOAuthSettings = {};
    for (const {field, input} of inputs) {
        if (!input) continue;
        input.addEventListener('change', async () => {
            status.textContent = 'Saving…';
            status.classList.remove('is-error');
            try {
                const value = input.value.trim();
                const updatedOAuth = { ...oauth, [field.key]: value };
                const saved = await window.api.updateSetting('withings', 'oauth', updatedOAuth);
                if (disposed) return;
                if (saved) {
                    oauth = updatedOAuth;
                    input.value = value;
                }
                status.textContent = saved ? 'Saved.' : 'Could not save this setting.';
                status.classList.toggle('is-error', !saved);
            } catch (error) {
                console.error('Failed to save Withings OAuth setting:', error);
                if (disposed) return;
                status.textContent = 'Could not save this setting.';
                status.classList.add('is-error');
            }
        }, { signal: controller.signal });
    }

    try {
        const settings = await window.api.getSettings();
        if (disposed) return;
        oauth = { ...settings.withings?.oauth };
        for (const {field, input} of inputs) {
            if (!input) continue;
            input.value = oauth[field.key] || '';
            input.disabled = false;
        }
        status.textContent = '';
    } catch (error) {
        console.error('Failed to load integration settings:', error);
        if (disposed) return;
        status.textContent = 'Could not load integration settings.';
        status.classList.add('is-error');
    }
}

export function cleanupIntegrations(): void {
    activeCleanup?.();
}