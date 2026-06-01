// Ambient declarations for packages whose package.json "exports" field
// points to .d.ts files that were not included in the published tarball.
// These are pre-existing issues in the upstream packages.

declare module 'embla-carousel-react' {
  export { default, UseEmblaCarouselType, EmblaViewportRefType } from '../../node_modules/embla-carousel-react/components/useEmblaCarousel';
}

declare module 'react-resizable-panels' {
  export { Panel, PanelGroup, PanelResizeHandle } from '../../node_modules/react-resizable-panels/dist/declarations/src/Panel';
  export { Panel, PanelGroup, PanelResizeHandle } from '../../node_modules/react-resizable-panels/dist/declarations/src/PanelGroup';
  export { Panel, PanelGroup, PanelResizeHandle } from '../../node_modules/react-resizable-panels/dist/declarations/src/PanelResizeHandle';
}

declare module 'input-otp' {
  import * as React from 'react';

  interface OTPSlot {
    char: string | null;
    hasFakeCaret: boolean;
    isActive: boolean;
  }

  interface OTPContextValue {
    slots: OTPSlot[];
  }

  export const OTPInputContext: React.Context<OTPContextValue>;

  interface OTPInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    maxLength: number;
    containerClassName?: string;
    render?: (props: { slots: OTPSlot[] }) => React.ReactNode;
    children?: React.ReactNode;
  }

  export const OTPInput: React.ForwardRefExoticComponent<
    OTPInputProps & React.RefAttributes<HTMLInputElement>
  >;
}
