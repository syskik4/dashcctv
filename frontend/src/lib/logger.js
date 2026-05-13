/**
 * Logger ligero. En producción no emite a consola para evitar exponer
 * detalles de error a usuarios; en desarrollo conserva el mensaje completo.
 */
const isDev = process.env.NODE_ENV !== "production";

export const logError = (...args) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export const logInfo = (...args) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info(...args);
  }
};
