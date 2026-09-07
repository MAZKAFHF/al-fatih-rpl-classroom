import os from "os";

export interface LocalAddress {
  name: string;
  address: string;
  family: string;
  isInternal: boolean;
}

export function getLocalIPv4Addresses(): LocalAddress[] {
  const interfaces = os.networkInterfaces();
  const result: LocalAddress[] = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family !== "IPv4") continue;
      if (info.internal) continue;
      // filter link-local 169.254.x.x
      if (info.address.startsWith("169.254.")) continue;
      result.push({
        name,
        address: info.address,
        family: info.family,
        isInternal: info.internal,
      });
    }
  }
  return result;
}

export function getPrimaryLocalIP(): string | null {
  const addrs = getLocalIPv4Addresses();
  if (addrs.length === 0) return null;
  // Prefer Wi-Fi interfaces: often contains Wi-Fi, Wireless, wlan, WiFi
  const wifi = addrs.find((a) => /wi-?fi|wlan|wireless/i.test(a.name));
  if (wifi) return wifi.address;
  // Prefer 192.168.x.x over others
  const private192 = addrs.find((a) => a.address.startsWith("192.168."));
  if (private192) return private192.address;
  return addrs[0].address;
}

export function getAllLocalUrls(port: number): { iface: string; url: string; ip: string }[] {
  const addrs = getLocalIPv4Addresses();
  return addrs.map((a) => ({
    iface: a.name,
    ip: a.address,
    url: `http://${a.address}:${port}`,
  }));
}
