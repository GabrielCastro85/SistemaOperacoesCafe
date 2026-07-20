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
