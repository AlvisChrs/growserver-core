import { Hono } from "hono";
import { HTTPS } from "../constants";
import { ensureTlsCertificate } from "../utils/tls";
import { TextParser } from "../utils/text-parser";
import { logger } from "../utils/logger";
import { serverManager } from "../game/server/server-manager";
import { getServerAddress } from "../configs/server-config";

function createLoginText(): string {
  const optimalServer = serverManager.getOptimalServer("least_connections");
  const selectedPort = optimalServer ? optimalServer.port.toString() : "17091";

  const text = new TextParser();
  text.add("server", getServerAddress());
  text.add("port", selectedPort);
  text.add("type", "1");
  text.add("type2", "1");
  text.add("meta", "localhost");
  text.add("loginurl", HTTPS.LOGIN_URL);

  return text.toString() + "\nRTENDMARKERBS1001";
}

export async function createHonoServer(): Promise<void> {
  const app = new Hono();

  const keyPath = HTTPS.TLS_KEY_PATH;
  const certPath = HTTPS.TLS_CERT_PATH;
  await ensureTlsCertificate(certPath, keyPath);

  app.get("/", async (c) => {
    return c.text("hello world");
  });

  app.all("/growtopia/server_data.php", async (c) => {
    const userAgent = c.req.header("user-agent") || "";
    let body: Record<string, unknown> = {};
    try {
      body = await c.req.parseBody();
    } catch {}

    const protocol = typeof body["protocol"] === "string" ? body["protocol"] : (c.req.query("protocol") || "");
    const version = typeof body["version"] === "string" ? body["version"] : (c.req.query("version") || "");
    const platform = typeof body["platform"] === "string" ? body["platform"] : (c.req.query("platform") || "");

    const isValidUserAgent = userAgent.startsWith(HTTPS.USER_AGENT_PREFIX) || HTTPS.USER_AGENTS.includes(userAgent);
    if (!isValidUserAgent || !protocol || !version || !platform) {
      logger.warn(
        { userAgent, protocol, version, platform },
        "incoming server data request had non-standard headers, allowing for local play",
      );
    }

    const loginText = createLoginText();
    logger.info({ loginText }, "server data response generated");

    return c.text(loginText);
  });

  Bun.serve({
    fetch: app.fetch,
    hostname: HTTPS.HOST,
    port: HTTPS.PORT,
  });
}
