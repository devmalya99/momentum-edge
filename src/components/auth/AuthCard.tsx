import Link from 'next/link';

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
};

export function AuthCard({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121217]/90 p-8 shadow-[0_25px_90px_rgba(14,165,233,0.1)]">
      <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
      <div className="mt-8">{children}</div>
      <p className="mt-6 text-sm text-gray-400">
        {footerText}{' '}
        <Link href={footerLinkHref} className="font-medium text-cyan-300 hover:text-cyan-200">
          {footerLinkText}
        </Link>
      </p>
    </div>
  );
}
