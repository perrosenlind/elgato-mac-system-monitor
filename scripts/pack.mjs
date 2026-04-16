#!/usr/bin/env node
// Creates a distributable .streamDeckPlugin installer.
// Installs only production deps (systeminformation, @napi-rs/canvas) inside sdPlugin,
// builds, then runs `streamdeck pack`.

import { spawnSync, execSync } from "node:child_process";
import { existsSync, rmSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const UUID = "com.perrosenlind.sysmon";
const SD_PLUGIN = resolve(`${UUID}.sdPlugin`);
const NM = join(SD_PLUGIN, "node_modules");

function run(label, cmd, args = [], opts = {}) {
  process.stdout.write(`• ${label}… `);
  const r = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", ...opts });
  if (r.status !== 0) {
    console.log("FAIL");
    if (r.stdout) console.log(r.stdout);
    if (r.stderr) console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  console.log("ok");
}

console.log(`\n📦 Packaging ${UUID}\n`);

run("building plugin", "npm", ["run", "build"]);
run("generating icons", "npm", ["run", "icons"]);

// Remove dev symlink / old node_modules inside sdPlugin
process.stdout.write("• installing production deps in sdPlugin… ");
if (existsSync(NM)) rmSync(NM, { recursive: true, force: true });

// Create a minimal package.json inside sdPlugin with only runtime deps
const rootPkg = JSON.parse(readFileSync("package.json", "utf8"));
const prodDeps = {
  "@napi-rs/canvas": rootPkg.dependencies["@napi-rs/canvas"],
  systeminformation: rootPkg.dependencies.systeminformation,
};
writeFileSync(
  join(SD_PLUGIN, "package.json"),
  JSON.stringify({ private: true, dependencies: prodDeps }, null, 2),
);

const r = spawnSync("npm", ["install", "--omit=dev"], {
  cwd: SD_PLUGIN,
  stdio: "pipe",
  encoding: "utf8",
});
if (r.status !== 0) {
  console.log("FAIL");
  console.error(r.stderr);
  process.exit(1);
}
// Remove the temp package.json and lock file
rmSync(join(SD_PLUGIN, "package.json"), { force: true });
rmSync(join(SD_PLUGIN, "package-lock.json"), { force: true });
console.log("ok");

run("packing .streamDeckPlugin", "streamdeck", ["pack", SD_PLUGIN]);

// Restore dev symlink for local development
process.stdout.write("• restoring dev node_modules symlink… ");
rmSync(NM, { recursive: true, force: true });
const { symlinkSync } = await import("node:fs");
symlinkSync(resolve("node_modules"), NM, "dir");
console.log("ok");

const installer = `${UUID}.streamDeckPlugin`;
if (existsSync(installer)) {
  const stat = (await import("node:fs")).statSync(installer);
  const mb = (stat.size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Created ${installer} (${mb} MB)\n`);
  console.log("Users can double-click this file to install the plugin.");
} else {
  console.log("\n⚠️  Pack command ran but installer file not found.\n");
}
