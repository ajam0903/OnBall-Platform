export const log = import.meta.env.DEV ? console.log : () => { };
export const logWarn = import.meta.env.DEV ? console.warn : () => { };
export const logError = console.error;