/// <reference types="vite-plugin-svgr/client" />

// Type untuk SVG yang di-import sebagai default
declare module '*.svg' {
  import type { FunctionComponent, SVGProps } from 'react'

  const content: FunctionComponent<SVGProps<SVGSVGElement> & { title?: string; desc?: string }>
  export default content
}
