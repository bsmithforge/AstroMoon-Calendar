// Temporary: surfaces the import-time error behind FUNCTION_INVOCATION_FAILED.
export async function GET(): Promise<Response> {
  const info: Record<string, unknown> = { node: process.version, cwd: process.cwd() };
  try {
    const mod = await import('../src/utils/subscription.js');
    info.subscriptionExports = Object.keys(mod);
    const built = mod.buildSubscriptionIcs(
      { timezone: 'UTC', hemisphere: 'northern', showFullNewMoon: true, showIngresses: false, showDailySigns: false, showEclipses: false },
      new Date()
    );
    info.eventCount = built.eventCount;
  } catch (error) {
    info.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error);
  }
  return new Response(JSON.stringify(info, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
