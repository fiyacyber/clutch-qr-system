declare module 'react-simple-maps' {
  import { ComponentType, ReactNode, SVGProps } from 'react';
  export interface ComposableMapProps { projectionConfig?: Record<string, any>; style?: React.CSSProperties; children?: ReactNode; }
  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const ZoomableGroup: ComponentType<{ zoom?: number; children?: ReactNode; [k: string]: any }>;
  export interface GeographiesProps { geography: string | object; children: (args: { geographies: any[] }) => ReactNode; }
  export const Geographies: ComponentType<GeographiesProps>;
  export interface GeographyProps extends SVGProps<SVGPathElement> { geography: any; key?: string; style?: { default?: object; hover?: object; pressed?: object }; }
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<any>;
  export const Line: ComponentType<any>;
  export const Annotation: ComponentType<any>;
}
