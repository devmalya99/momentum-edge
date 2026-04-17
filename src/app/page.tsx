import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080c]">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-200px] left-[-100px] h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-[130px]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-8 py-16">
        <p className="inline-flex w-fit items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
          Momentum Edge Community
        </p>

        <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
          Trade with discipline in a premium environment built for serious stock market traders.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-gray-300">
          Join a focused community, track high-conviction setups, and refine your edge with clean
          analytics and precise execution workflows.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/signup"
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}
