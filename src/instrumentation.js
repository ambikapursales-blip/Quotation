export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // MongoDB initialization is handled in server.mjs
  // This file is kept for future instrumentation needs
}