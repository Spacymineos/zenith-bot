import "dotenv/config";
import { Client, GatewayIntentBits, Collection, Events, REST, Routes, type ChatInputCommandInteraction } from "discord.js";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import cron from "node-cron";
import { prisma, error as embedError, getErrorMessage } from "./core.js";
import { ENV, type CommandModule } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

declare module "discord.js" {
  export interface Client { commands: Collection<string, CommandModule>; }
}

async function boot() {
  // Config check is already partially handled by ENV mapping, but we can ensure mandatory ones here
  const MANDATORY: (keyof typeof ENV)[] = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DATABASE_URL", "ENCRYPTION_KEY", "BOT_WALLET_PRIVATE_KEY"];
  for (const k of MANDATORY) if (!ENV[k]) throw new Error(`Missing environment variable: ${k}`);

  const cmdDir = join(__dirname, "commands");
  const files = readdirSync(cmdDir).filter(f => f.endsWith(".js") || f.endsWith(".ts"));
  const mods = (await Promise.all(files.map(async f => {
    const m = await import(pathToFileURL(join(cmdDir, f)).href);
    return m.data && m.execute ? m : null;
  }))).filter((m): m is CommandModule => m !== null);

  if (ENV.DEPLOY_COMMANDS) {
    const rest = new REST({ version: "10" }).setToken(ENV.DISCORD_TOKEN);
    console.log(`[DEPLOY] Refreshing ${mods.length} application (/) commands...`);
    await rest.put(Routes.applicationCommands(ENV.DISCORD_CLIENT_ID), { body: mods.map(m => m.data.toJSON()) });
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });
  client.commands = new Collection(mods.map(m => [m.data.name, m]));

  client.once(Events.ClientReady, c => {
    console.log(`[BOT] Logged in as ${c.user.tag}`);
    // Cleanup old cooldowns every hour
    cron.schedule("0 * * * *", () => {
      const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      prisma.cooldown.deleteMany({ where: { lastUsed: { lt: dayAgo } } })
        .catch(e => console.error("[CRON] Cooldown cleanup failed:", e));
    });
  });

  client.on(Events.InteractionCreate, async i => {
    if (!i.isChatInputCommand()) return;
    const cmd = client.commands.get(i.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(i);
    } catch (err: unknown) {
      console.error(`[ERR] Command /${i.commandName} failed:`, err);
      const p = { embeds: [embedError(`An unexpected error occurred: ${getErrorMessage(err)}`)], ephemeral: true as const };
      i.deferred || i.replied ? await i.editReply(p) : await i.reply(p);
    }
  });

  process.on("SIGINT", () => {
    console.log("[BOT] Shutting down...");
    client.destroy();
    prisma.$disconnect();
    process.exit(0);
  });

  await client.login(ENV.DISCORD_TOKEN);
}

boot().catch(e => {
  console.error("[FATAL] Boot failed:", e);
  process.exit(1);
});
