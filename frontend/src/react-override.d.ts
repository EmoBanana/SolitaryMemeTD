// Fix for React 19 type issues
import * as React from "react";

declare module "react" {
  export = React;
  export as namespace React;

  export interface ReactModule {
    useState: typeof React.useState;
    useEffect: typeof React.useEffect;
    useContext: typeof React.useContext;
    useReducer: typeof React.useReducer;
    useCallback: typeof React.useCallback;
    useMemo: typeof React.useMemo;
    useRef: typeof React.useRef;
    useImperativeHandle: typeof React.useImperativeHandle;
    useLayoutEffect: typeof React.useLayoutEffect;
    useDebugValue: typeof React.useDebugValue;
  }
}

// Add JSX declarations to fix the missing element types
declare namespace JSX {
  interface IntrinsicElements {
    div: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLDivElement>,
      HTMLDivElement
    >;
    span: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLSpanElement>,
      HTMLSpanElement
    >;
    h1: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLHeadingElement>,
      HTMLHeadingElement
    >;
    h2: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLHeadingElement>,
      HTMLHeadingElement
    >;
    h3: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLHeadingElement>,
      HTMLHeadingElement
    >;
    p: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLParagraphElement>,
      HTMLParagraphElement
    >;
    a: React.DetailedHTMLProps<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      HTMLAnchorElement
    >;
    button: React.DetailedHTMLProps<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      HTMLButtonElement
    >;
    header: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    main: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    nav: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    footer: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    input: React.DetailedHTMLProps<
      React.InputHTMLAttributes<HTMLInputElement>,
      HTMLInputElement
    >;
    form: React.DetailedHTMLProps<
      React.FormHTMLAttributes<HTMLFormElement>,
      HTMLFormElement
    >;
    label: React.DetailedHTMLProps<
      React.LabelHTMLAttributes<HTMLLabelElement>,
      HTMLLabelElement
    >;
    img: React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >;
    section: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    article: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    aside: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    ul: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLUListElement>,
      HTMLUListElement
    >;
    ol: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLOListElement>,
      HTMLOListElement
    >;
    li: React.DetailedHTMLProps<
      React.LiHTMLAttributes<HTMLLIElement>,
      HTMLLIElement
    >;
    textarea: React.DetailedHTMLProps<
      React.TextareaHTMLAttributes<HTMLTextAreaElement>,
      HTMLTextAreaElement
    >;
    select: React.DetailedHTMLProps<
      React.SelectHTMLAttributes<HTMLSelectElement>,
      HTMLSelectElement
    >;
    option: React.DetailedHTMLProps<
      React.OptionHTMLAttributes<HTMLOptionElement>,
      HTMLOptionElement
    >;
    table: React.DetailedHTMLProps<
      React.TableHTMLAttributes<HTMLTableElement>,
      HTMLTableElement
    >;
    tr: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLTableRowElement>,
      HTMLTableRowElement
    >;
    td: React.DetailedHTMLProps<
      React.TdHTMLAttributes<HTMLTableDataCellElement>,
      HTMLTableDataCellElement
    >;
    th: React.DetailedHTMLProps<
      React.ThHTMLAttributes<HTMLTableHeaderCellElement>,
      HTMLTableHeaderCellElement
    >;
    thead: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLTableSectionElement>,
      HTMLTableSectionElement
    >;
    tbody: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLTableSectionElement>,
      HTMLTableSectionElement
    >;
    tfoot: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLTableSectionElement>,
      HTMLTableSectionElement
    >;
    style: React.DetailedHTMLProps<
      React.StyleHTMLAttributes<HTMLStyleElement>,
      HTMLStyleElement
    >;
    // SVG elements
    svg: React.SVGProps<SVGSVGElement>;
    path: React.SVGProps<SVGPathElement>;
    circle: React.SVGProps<SVGCircleElement>;
    rect: React.SVGProps<SVGRectElement>;
    line: React.SVGProps<SVGLineElement>;
    polyline: React.SVGProps<SVGPolylineElement>;
    polygon: React.SVGProps<SVGPolygonElement>;
    // Add more HTML elements as needed
  }
}

export {};
