import type {BiometricsSettings} from '../../../shared/types/index.js';
import {DateInput} from '../../components/date-input/date-input.js';

type SettingKey = keyof BiometricsSettings;

const settingKeys: SettingKey[] = ['idealBmiUpperBound', 'idealBmiLowerBound', 'height', 'dateOfBirth', 'sex'];
let activeCleanup: (() => void) | null = null;

export async function loadSettings(): Promise<void> {
    activeCleanup?.();

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const template = document.getElementById('tpl-settings-dashboard') as HTMLTemplateElement | null;
    const dashboard = template?.content.firstElementChild?.cloneNode(true);
    if (!(dashboard instanceof HTMLElement)) {
        console.error('Could not find the Settings page template.');
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

    const status = dashboard.querySelector<HTMLElement>('.settings-status');
    const retryButton = dashboard.querySelector<HTMLButtonElement>('.settings-retry');
    const inputs = settingKeys.map(key => ({
        key,
        input: dashboard.querySelector<HTMLInputElement>(`[data-setting="${key}"]`)
    }));
    if (!status || !retryButton || inputs.some(({input}) => !input)) {
        cleanup();
        console.error('The Settings page template is missing a biometrics field.');
        return;
    }

    const fields = inputs as {key: SettingKey; input: HTMLInputElement}[];
    const dateField = fields.find(({key}) => key === 'dateOfBirth')!;
    const dateInput = new DateInput(dateField.input, {
        onChange: value => { void saveField(dateField, value); }
    });

    let retryAction: (() => void) | null = null;
    let saving = false;
    const setStatus = (message: string, isError = false, retry: (() => void) | null = null) => {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
        retryAction = retry;
        retryButton.hidden = !retry;
    };
    const setFieldDisabled = (field: {key: SettingKey; input: HTMLInputElement}, disabled: boolean) => {
        if (field.key === 'dateOfBirth') dateInput.disabled = disabled;
        else field.input.disabled = disabled;
    };
    const setFieldsDisabled = (disabled: boolean) => fields.forEach(field => setFieldDisabled(field, disabled));
    const validate = (key: SettingKey, rawValue: string | number | null): number | BiometricsSettings['sex'] => {
        if (key === 'dateOfBirth') {
            if (rawValue === null) return undefined;
            if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue > Math.floor(Date.now() / 1000)) {
                throw new Error('Enter a valid date of birth.');
            }
            return rawValue;
        }
        const value = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (!value) return undefined;
        if (key === 'sex') {
            const sex = value.toUpperCase();
            if (sex === 'M' || sex === 'F') return sex;
            throw new Error('Sex must be M or F.');
        }
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) throw new Error('Enter a number greater than zero.');
        return number;
    };

    async function saveField(field: {key: SettingKey; input: HTMLInputElement}, rawValue: string | number | null) {
        if (disposed || saving) return;
        const {key, input} = field;
        let value: number | BiometricsSettings['sex'];
        try {
            value = validate(key, rawValue);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Enter a valid value.', true);
            return;
        }

        saving = true;
        setFieldsDisabled(true);
        setStatus('Saving…');
        try {
            const saved = await window.api.updateSetting('biometrics', key, value);
            if (disposed) return;
            if (!saved) {
                setStatus('Could not save this setting.', true, () => { void saveField(field, rawValue); });
                return;
            }
            if (key === 'sex' && typeof value === 'string') input.value = value;
            setStatus('Saved.');
        } catch (error) {
            console.error(`Failed to save biometrics setting ${key}:`, error);
            if (disposed) return;
            setStatus('Could not save this setting.', true, () => { void saveField(field, rawValue); });
        } finally {
            saving = false;
            if (!disposed) setFieldsDisabled(false);
        }
    }

    retryButton.addEventListener('click', () => retryAction?.(), {signal: controller.signal});
    fields.forEach(field => {
        if (field.key === 'dateOfBirth') return;
        field.input.addEventListener('change', () => { void saveField(field, field.input.value); }, {signal: controller.signal});
    });

    mainContent.appendChild(dashboard);
    setFieldsDisabled(true);

    try {
        const settings = await window.api.getSettings();
        if (disposed) return;
        const biometrics = settings.biometrics ?? {};
        fields.forEach(({key, input}) => {
            const value = biometrics[key];
            if (key === 'dateOfBirth') dateInput.value = typeof value === 'number' ? value : null;
            else input.value = value === undefined ? '' : String(value);
        });
        setStatus('');
    } catch (error) {
        console.error('Failed to load biometrics settings:', error);
        if (disposed) return;
        setStatus('Could not load biometrics settings.', true);
    } finally {
        if (!disposed) setFieldsDisabled(false);
    }
}

export function cleanupSettings(): void {
    activeCleanup?.();
}