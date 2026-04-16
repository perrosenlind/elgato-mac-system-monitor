import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { CpuAction } from "./actions/cpu-action.js";
import { GpuAction } from "./actions/gpu-action.js";
import { MemoryAction } from "./actions/memory-action.js";
import { NetworkAction } from "./actions/network-action.js";
import { PingAction } from "./actions/ping-action.js";
import { StorageAction } from "./actions/storage-action.js";

streamDeck.logger.setLevel(LogLevel.INFO);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const register = (a: any) => streamDeck.actions.registerAction(a);

register(new CpuAction());
register(new GpuAction());
register(new MemoryAction());
register(new StorageAction());
register(new PingAction());
register(new NetworkAction());

streamDeck.connect();
