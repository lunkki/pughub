type Props = {
  params: { code: string };
};

export default function ScrimLobbyPage({ params }: Props) {
  const { code } = params;

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold">Scrim lobby: {code}</h1>
      <p className="mt-2 text-sm text-slate-300">
        This is a placeholder lobby page. Later it will show players, teams,
        ready status, and a “Start match” button hooked to RCON.
      </p>
    </div>
  );
}
