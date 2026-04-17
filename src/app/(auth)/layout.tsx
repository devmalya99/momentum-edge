export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08090d]">
      <div className="pointer-events-none absolute left-1/2 top-[-200px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-220px] right-[-120px] h-[450px] w-[450px] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
