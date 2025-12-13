import net from "net";

const DEFAULT_CONNECT_PASSWORD =
  process.env.DEFAULT_SERVER_PASSWORD || "secret-password-here";

type HostPort = { host: string; port: number };

function parseHostPort(address: string): HostPort {
  const [host, portString] = address.split(":");
  const port = Number(portString) || 27015;
  return { host, port };
}

export function getConnectPassword() {
  return DEFAULT_CONNECT_PASSWORD;
}

export function buildConnectString(address: string, password?: string) {
  const pass = password || getConnectPassword();
  return `connect ${address}; password ${pass}`;
}

type SendOptions = {
  host: string;
  port: number;
  password: string;
  commands: string[];
  timeoutMs?: number;
};

async function sendRconCommands({
  host,
  port,
  password,
  commands,
  timeoutMs = 5000,
}: SendOptions) {
  // Simple Source RCON client (single-threaded, minimal buffering)
  const socket = net.createConnection({ host, port });
  let buffer = Buffer.alloc(0);
  let closed = false;

  const createPacket = (id: number, type: number, body: string) => {
    const bodyBuf = Buffer.from(body, "utf8");
    const size = 4 + 4 + bodyBuf.length + 2;
    const buf = Buffer.alloc(4 + size);
    buf.writeInt32LE(size, 0);
    buf.writeInt32LE(id, 4);
    buf.writeInt32LE(type, 8);
    bodyBuf.copy(buf, 12);
    buf[12 + bodyBuf.length] = 0x00;
    buf[13 + bodyBuf.length] = 0x00;
    return buf;
  };

  const waitForPacket = () =>
    new Promise<{ id: number; type: number; body: string }>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Need at least 4 bytes for size
        if (buffer.length < 4) return;
        const size = buffer.readInt32LE(0);
        if (buffer.length < size + 4) return; // not enough yet

        const packet = buffer.slice(0, size + 4);
        buffer = buffer.slice(size + 4);

        const id = packet.readInt32LE(4);
        const type = packet.readInt32LE(8);
        const body = packet
          .slice(12, size + 4)
          .toString("utf8")
          .replace(/\0+$/, "");

        cleanup();
        resolve({ id, type, body });
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onClose = () => {
        if (!closed) {
          reject(new Error("RCON connection closed"));
        }
      };

      const cleanup = () => {
        socket.off("data", onData);
        socket.off("error", onError);
        socket.off("close", onClose);
      };

      socket.on("data", onData);
      socket.on("error", onError);
      socket.on("close", onClose);
    });

  const waitForConnect = () =>
    new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", reject);
    });

  const abortAfter = (ms: number) =>
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RCON timeout")), ms).unref();
    });

  try {
    await Promise.race([waitForConnect(), abortAfter(timeoutMs)]);

    const AUTH = 3;
    const EXEC = 2;

    // Auth
    socket.write(createPacket(1, AUTH, password));
    const authResp = await Promise.race([waitForPacket(), abortAfter(timeoutMs)]);
    if (authResp.id === -1) {
      throw new Error("RCON auth failed");
    }

    // Send commands sequentially and wait for a reply per command
    for (let i = 0; i < commands.length; i++) {
      const id = 10 + i;
      socket.write(createPacket(id, EXEC, commands[i]));
      await Promise.race([waitForPacket(), abortAfter(timeoutMs)]);
    }
  } finally {
    closed = true;
    socket.end();
  }
}

type LaunchOptions = {
  address: string;
  rconPassword: string;
  map: string;
  connectPassword?: string;
};

export async function launchScrimServer({
  address,
  rconPassword,
  map,
  connectPassword,
}: LaunchOptions) {
  const { host, port } = parseHostPort(address);
  const password = connectPassword || getConnectPassword();

  const commands = [
    `sv_password ${password}`,
    "exec comp",
    `changelevel ${map}`,
  ];

  await sendRconCommands({
    host,
    port,
    password: rconPassword,
    commands,
  });
}

export async function runRconCommand({
  address,
  rconPassword,
  command,
  timeoutMs,
}: {
  address: string;
  rconPassword: string;
  command: string;
  timeoutMs?: number;
}) {
  const { host, port } = parseHostPort(address);
  await sendRconCommands({
    host,
    port,
    password: rconPassword,
    commands: [command],
    timeoutMs,
  });
}
