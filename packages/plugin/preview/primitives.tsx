import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function PreviewIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" {...props}>
      {children}
    </svg>
  );
}

export function IconCloseOutline16(props: IconProps) {
  return <PreviewIcon {...props}><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeLinecap="round" /></PreviewIcon>;
}

export function IconPlusOutline16(props: IconProps) {
  return <PreviewIcon {...props}><path d="M8 3v10M3 8h10" stroke="currentColor" strokeLinecap="round" /></PreviewIcon>;
}

export function IconRefreshOutline16(props: IconProps) {
  return <PreviewIcon {...props}><path d="M12.5 6A5 5 0 1 0 13 9M12.5 3v3h-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></PreviewIcon>;
}

export function IconRightUpOutline14(props: IconProps) {
  return <PreviewIcon {...props}><path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></PreviewIcon>;
}

export function IconSearchOutline16(props: IconProps) {
  return <PreviewIcon {...props}><circle cx="7" cy="7" r="3.75" stroke="currentColor" /><path d="m10 10 3 3" stroke="currentColor" strokeLinecap="round" /></PreviewIcon>;
}
