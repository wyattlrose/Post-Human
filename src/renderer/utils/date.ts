/** Formats Unix seconds as 'DD-MM-YY' in local time. */
export function formatDate(seconds: number): string {
    const date = new Date(seconds * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${pad(date.getFullYear() % 100)}`;
}