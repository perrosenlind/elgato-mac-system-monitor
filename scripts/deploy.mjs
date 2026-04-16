#!/usr/bin/env node
// One-shot installer: builds, generates icons, links into Stream Deck, restarts.
// Usage: npm run deploy

import { execSync, spawnSync } from "node:child_process";
import { existsSync, symlinkSync, mkdirSync, rmSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

const UUID = "com.perrosenlind.sysmon";
const PLUGIN_DIR = resolve(`${UUID}.sdPlugin`);
const SD_PLUGINS = join(
  homedir(),
  "Library/Application Support/com.elgato.StreamDeck/Plugins",
);
const TARGET = join(SD_PLUGINS, `${UUID}.sdPlugin`);

function run(label, cmd, args = []) {
  process.stdout.write(`• ${label}… `);
  const r = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) {
    console.log("FAIL");
    if (r.stdout) console.log(r.stdout);
    if (r.stderr) console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  console.log("ok");
}

function step(label, fn) {
  process.stdout.write(`• ${label}… `);
  try {
    fn();
    console.log("ok");
  } catch (err) {
    console.log("FAIL");
    console.error(err.message ?? err);
    process.exit(1);
  }
}

function hasStreamDeckCli() {
  const r = spawnSync("streamdeck", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function killStreamDeckApp() {
  try {
    execSync("pkill -x 'Stream Deck' || true", { stdio: "ignore" });
  } catch {}
}

function openStreamDeckApp() {
  try {
    execSync("open -a 'Stream Deck'", { stdio: "ignore" });
  } catch {}
}

console.log(`\n📦 Deploying ${UUID}\n`);

run("building plugin (rollup)", "npm", ["run", "build"]);
run("generating icons", "npm", ["run", "icons"]);

step("linking node_modules into sdPlugin", () => {
  const nmLink = join(PLUGIN_DIR, "node_modules");
  const nmSource = resolve("node_modules");
  if (existsSync(nmLink) || lstatSync(nmLink, { throwIfNoEntry: false })) {
    rmSync(nmLink, { recursive: true, force: true });
  }
  symlinkSync(nmSource, nmLink, "dir");
});

step("linking into Stream Deck Plugins folder", () => {
  if (!existsSync(SD_PLUGINS)) {
    mkdirSync(SD_PLUGINS, { recursive: true });
  }
  if (existsSync(TARGET) || lstatSync(TARGET, { throwIfNoEntry: false })) {
    rmSync(TARGET, { recursive: true, force: true });
  }
  symlinkSync(PLUGIN_DIR, TARGET, "dir");
});

step("restarting Stream Deck app", () => {
  if (hasStreamDeckCli()) {
    const r = spawnSync("streamdeck", ["restart", UUID], { stdio: "ignore" });
    if (r.status !== 0) {
      killStreamDeckApp();
      setTimeout(openStreamDeckApp, 500);
    }
  } else {
    killStreamDeckApp();
    setTimeout(openStreamDeckApp, 500);
  }
});

console.log(`
✅ Done.

   Plugin link:  ${TARGET}
   → ${PLUGIN_DIR}

Open the Stream Deck app and drag any "System Monitor" action onto a key.
Re-run \`npm run deploy\` after changes, or use \`npm run watch\` during dev.
`);
