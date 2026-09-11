/**
 * The screen a build was asked to open on, or null for the app's own start.
 *
 * Rewritten by the build command and put straight back afterwards, so what is
 * committed is always null. It is a source file rather than an environment
 * variable because Metro caches a module by its contents: with the source
 * unchanged, `process.env.EXPO_PUBLIC_*` kept its value from the first build
 * of the day no matter what the shell said.
 */
export const DEV_SCREEN: string | null = null;
