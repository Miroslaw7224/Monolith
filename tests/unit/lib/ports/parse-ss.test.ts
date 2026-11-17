// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseSs } from "@/lib/ports/parse-ss";

describe("parseSs", () => {
  it("czyta port, adres, PID i nazwę procesu", () => {
    const raw =
      'LISTEN 0      511        127.0.0.1:3101       0.0.0.0:*    users:(("next-server (v1",pid=2562323,fd=22))\n';
    expect(parseSs(raw)).toEqual([
      {
        port: 3101,
        address: "127.0.0.1",
        pid: 2562323,
        process: "next-server (v1",
        path: null,
        commandLine: null,
      },
    ]);
  });

  it("wiersz bez users: ma pid null i process null", () => {
    const [row] = parseSs("LISTEN 0      4096              *:5434             *:*\n");
    expect(row).toMatchObject({ port: 5434, address: "*", pid: null, process: null });
  });

  it("dzieli po ostatnim dwukropku i zdejmuje nawiasy IPv6", () => {
    const [row] = parseSs("LISTEN 0 128 [::]:22 [::]:*\n");
    expect(row).toMatchObject({ port: 22, address: "::" });
  });

  it("zdejmuje %iface z adresu", () => {
    const [a] = parseSs("LISTEN 0 128 [fe80::1%eth0]:8080 [::]:*\n");
    expect(a).toMatchObject({ port: 8080, address: "fe80::1" });
    const [b] = parseSs("LISTEN 0 4096 127.0.0.53%lo:53 0.0.0.0:*\n");
    expect(b).toMatchObject({ port: 53, address: "127.0.0.53" });
  });

  it("z kilku procesów bierze pierwszy", () => {
    const [row] = parseSs(
      'LISTEN 0 1 0.0.0.0:80 0.0.0.0:* users:(("a",pid=1,fd=3),("b",pid=2,fd=4))\n'
    );
    expect(row).toMatchObject({ process: "a", pid: 1 });
  });

  it("pusty wynik, śmieci i nagłówek dają []", () => {
    expect(parseSs("")).toEqual([]);
    expect(parseSs("State Recv-Q Send-Q Local Address:Port Peer Address:Port\n")).toEqual([]);
    expect(parseSs("LISTEN 0 1 bezportu 0.0.0.0:*\n")).toEqual([]);
  });
});
