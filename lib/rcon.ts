export type RconCommandResult = {
  ok: boolean;
  output?: string;
  error?: string;
};

export async function sendRconCommand(
  serverAddress: string,
  password: string,
  command: string
): Promise<RconCommandResult> {
  // TODO: implement using a Node RCON library
  console.log("RCON command", { serverAddress, command });
  return { ok: true };
}
