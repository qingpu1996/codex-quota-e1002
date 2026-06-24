import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type { NetworkInfo } from "./types";

const execFileAsync = promisify(execFile);

export async function detectDefaultNetwork(): Promise<NetworkInfo> {
  const route = await execFileAsync("/sbin/route", ["-n", "get", "default"]);
  const interfaceName = route.stdout.match(/interface:\s+(\S+)/)?.[1];
  if (!interfaceName) {
    throw new Error("Could not detect default network interface");
  }

  const ip = await execFileAsync("/usr/sbin/ipconfig", ["getifaddr", interfaceName]);
  const ipv4 = ip.stdout.trim();
  if (!ipv4) {
    throw new Error(`Default network interface ${interfaceName} has no IPv4 address`);
  }

  const ifconfig = await execFileAsync("/sbin/ifconfig", [interfaceName]);
  const mac = ifconfig.stdout.match(/\bether\s+([0-9a-f:]+)/i)?.[1] ?? "";
  if (!mac) {
    throw new Error(`Could not detect MAC address for ${interfaceName}`);
  }

  return { interfaceName, ipv4, mac };
}

export function isIpAssigned(ipv4: string): boolean {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && address.address === ipv4) {
        return true;
      }
    }
  }
  return false;
}
