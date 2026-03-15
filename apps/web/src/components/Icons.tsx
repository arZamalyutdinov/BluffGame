import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function BotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5.5" y="7" width="13" height="10.5" rx="3" />
      <path d="M12 3.75v3.25" />
      <path d="M8.75 12h.01" />
      <path d="M15.25 12h.01" />
      <path d="M9 15h6" />
      <path d="M4.5 10.25v4.5" />
      <path d="M19.5 10.25v4.5" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 12H6.5" />
      <path d="m11.25 17.25-5.25-5.25 5.25-5.25" />
    </IconBase>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.25 7.25a3 3 0 0 1 3-3h7.5a3 3 0 0 1 3 3v5.2a3 3 0 0 1-3 3H11l-3.75 3v-3H8.25a3 3 0 0 1-3-3z" />
    </IconBase>
  );
}

export function CardsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="6" width="9.5" height="12" rx="2" />
      <path d="M8.5 9.5h2.5" />
      <path d="M8.5 13h2.5" />
      <path d="M10.75 5.25l3.7-1.4a2 2 0 0 1 2.58 1.16l3.1 8.2a2 2 0 0 1-1.16 2.58l-3.95 1.49" />
    </IconBase>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 18.5h15l-1.45-9.5-5.05 4.2L12 7.5l-5 5.7L5.95 9z" />
      <path d="M8 18.5v1.75" />
      <path d="M16 18.5v1.75" />
    </IconBase>
  );
}

export function DoorIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 4.5h7.5v15H10" />
      <path d="M6.5 12h8.25" />
      <path d="m9.25 9.25-2.75 2.75 2.75 2.75" />
    </IconBase>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m10 8.75 5 3.25-5 3.25z" />
    </IconBase>
  );
}

export function ReadyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.2 2.2 4.8-5.1" />
    </IconBase>
  );
}

export function SeatsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8" cy="9" r="2.75" />
      <circle cx="16.25" cy="10.25" r="2.35" />
      <path d="M4.75 17.75c.8-2.2 2.48-3.3 5.05-3.3s4.25 1.1 5.05 3.3" />
      <path d="M14.1 17.75c.55-1.55 1.7-2.35 3.45-2.35 1.2 0 2.18.38 2.95 1.15" />
    </IconBase>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 12.75a6 6 0 0 1 12 0" />
      <path d="M8.6 12.75a3.4 3.4 0 0 1 6.8 0" />
      <circle cx="12" cy="16.75" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 4 9 15" />
      <path d="m20 4-7.5 16-2.4-6.1L4 11.5z" />
    </IconBase>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3.5 1.55 4.95L18.5 10l-4.95 1.55L12 16.5l-1.55-4.95L5.5 10l4.95-1.55z" />
      <path d="m18.5 4.5.65 2.1 2.1.65-2.1.65-.65 2.1-.65-2.1-2.1-.65 2.1-.65z" />
    </IconBase>
  );
}

export function TimerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13" r="7.25" />
      <path d="M9 3.75h6" />
      <path d="M12 13V9.5" />
      <path d="m12 13 2.5 2.1" />
    </IconBase>
  );
}
