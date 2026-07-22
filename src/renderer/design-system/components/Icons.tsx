import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(children: React.ReactNode, props: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SackIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M12 3 4 7.2v9.6L12 21l8-4.2V7.2L12 3Z" />
      <path d="M4 7.2 12 11l8-3.8" />
      <path d="M12 11v10" />
    </>,
    props
  );
}

export function CoinsIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M15 9.2c0-1.2-1.3-2.2-3-2.2s-3 .9-3 2.1 1.3 1.8 3 2.1 3 .9 3 2.1-1.3 2.1-3 2.1-3-1-3-2.2" />
    </>,
    props
  );
}

export function WalletIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </>,
    props
  );
}

export function CheckCircleIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-4.8" />
    </>,
    props
  );
}

export function UploadIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M12 15V4" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>,
    props
  );
}

export function FileTextIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h6M9 8.5h3" />
    </>,
    props
  );
}

export function ListStepsIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <circle cx="5" cy="6" r="1.6" />
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="5" cy="18" r="1.6" />
      <path d="M9.5 6h9M9.5 12h9M9.5 18h9" />
    </>,
    props
  );
}

export function BuildingIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" />
      <path d="M14 21v-9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v9" />
      <path d="M4 21h16" />
      <path d="M7.5 7.5h.01M10.5 7.5h.01M7.5 11h.01M10.5 11h.01M7.5 14.5h.01M10.5 14.5h.01" />
    </>,
    props
  );
}

export function HandshakeIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="m3 11 4.5-4.5a2 2 0 0 1 2.8 0L12 8.2l1.7-1.7a2 2 0 0 1 2.8 0L21 11" />
      <path d="m7 12 3 3a1.6 1.6 0 0 0 2.3 0 1.6 1.6 0 0 0 0-2.3L9 9.4" />
      <path d="m17 12-3.4 3.4a1.6 1.6 0 0 1-2.3 0" />
      <path d="M3 11v3a1 1 0 0 0 .3.7L6 17.5M21 11v3a1 1 0 0 1-.3.7L18 17.5" />
    </>,
    props
  );
}

export function DashboardIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="5" rx="1.5" />
      <rect x="13" y="11" width="7" height="9" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
    </>,
    props
  );
}

export function InvoiceIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M7 3h10a1 1 0 0 1 1 1v17l-3-1.5L12 21l-3-1.5L6 21V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>,
    props
  );
}

export function UsersIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5a2.6 2.6 0 0 1 0 5.1" />
      <path d="M17 14c2 .6 3.2 2.2 3.5 5" />
    </>,
    props
  );
}

export function PackageIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z" />
      <path d="M4.5 7 12 11l7.5-4" />
      <path d="M12 11v10" />
      <path d="m8.5 5.1 7.2 4" />
    </>,
    props
  );
}

export function RateIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M4 19 19 4" />
      <circle cx="7" cy="7" r="2.2" />
      <circle cx="17" cy="17" r="2.2" />
    </>,
    props
  );
}

export function LedgerIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
      <path d="M5 5 3.5 7M19 5l1.5 2" />
    </>,
    props
  );
}

export function ReportIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M6 20V4h12v16" />
      <path d="M9 17v-4M12 17V8M15 17v-6" />
      <path d="M4 20h16" />
    </>,
    props
  );
}

export function UserAdminIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="m18 5 1 1 2-2" />
    </>,
    props
  );
}

export function RolesIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M12 3 5 6v5c0 4.4 2.8 7.9 7 10 4.2-2.1 7-5.6 7-10V6l-7-3Z" />
      <path d="M9 12h6M12 9v6" />
    </>,
    props
  );
}

export function AuditIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4" />
      <path d="M10 13h5M10 17h5M9 9h2" />
    </>,
    props
  );
}

export function BackupIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M6 12a6 6 0 1 1 2 4.5" />
      <path d="M6 16.5H3.5V14" />
      <path d="M12 8v5l3 1.5" />
    </>,
    props
  );
}

export function IntegrityIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <path d="M12 3 5 6v5c0 4.4 2.8 7.9 7 10 4.2-2.1 7-5.6 7-10V6l-7-3Z" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </>,
    props
  );
}

export function SettingsIcon(props: IconProps): JSX.Element {
  return base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.8-1L14.4 3h-4.8L9.3 6a7.4 7.4 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.8 1l.3 3h4.8l.3-3a7.4 7.4 0 0 0 1.8-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
    </>,
    props
  );
}
