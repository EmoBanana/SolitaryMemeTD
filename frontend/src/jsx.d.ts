import React from "react";

declare global {
  namespace JSX {
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
      h4: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h5: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h6: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      p: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLParagraphElement>,
        HTMLParagraphElement
      >;
      input: React.DetailedHTMLProps<
        React.InputHTMLAttributes<HTMLInputElement>,
        HTMLInputElement
      >;
      button: React.DetailedHTMLProps<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        HTMLButtonElement
      >;
      a: React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >;
      img: React.DetailedHTMLProps<
        React.ImgHTMLAttributes<HTMLImageElement>,
        HTMLImageElement
      >;
      header: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      nav: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      main: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      label: React.DetailedHTMLProps<
        React.LabelHTMLAttributes<HTMLLabelElement>,
        HTMLLabelElement
      >;
      svg: React.SVGProps<SVGSVGElement>;
      path: React.SVGProps<SVGPathElement>;
      br: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLBRElement>,
        HTMLBRElement
      >;
      footer: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
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
      form: React.DetailedHTMLProps<
        React.FormHTMLAttributes<HTMLFormElement>,
        HTMLFormElement
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
      ul: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLUListElement>,
        HTMLUListElement
      >;
      ol: React.DetailedHTMLProps<
        React.OListHTMLAttributes<HTMLOListElement>,
        HTMLOListElement
      >;
      li: React.DetailedHTMLProps<
        React.LiHTMLAttributes<HTMLLIElement>,
        HTMLLIElement
      >;
      table: React.DetailedHTMLProps<
        React.TableHTMLAttributes<HTMLTableElement>,
        HTMLTableElement
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
      tr: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLTableRowElement>,
        HTMLTableRowElement
      >;
      th: React.DetailedHTMLProps<
        React.ThHTMLAttributes<HTMLTableHeaderCellElement>,
        HTMLTableHeaderCellElement
      >;
      td: React.DetailedHTMLProps<
        React.TdHTMLAttributes<HTMLTableDataCellElement>,
        HTMLTableDataCellElement
      >;
      canvas: React.DetailedHTMLProps<
        React.CanvasHTMLAttributes<HTMLCanvasElement>,
        HTMLCanvasElement
      >;
      // Add any other HTML elements you need
    }
  }
}

// Add React hook type declarations
declare module "react" {
  function useState<T>(
    initialState: T | (() => T)
  ): [T, (newState: T | ((prevState: T) => T)) => void];
  function useEffect(
    effect: () => void | (() => void),
    deps?: ReadonlyArray<any>
  ): void;
  function useContext<T>(context: React.Context<T>): T;
  function useReducer<R extends React.Reducer<any, any>, I>(
    reducer: R,
    initializerArg: I & React.ReducerState<R>,
    initializer?: (arg: I & React.ReducerState<R>) => React.ReducerState<R>
  ): [React.ReducerState<R>, React.Dispatch<React.ReducerAction<R>>];
  function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: ReadonlyArray<any>
  ): T;
  function useMemo<T>(
    factory: () => T,
    deps: ReadonlyArray<any> | undefined
  ): T;
  function useRef<T>(initialValue: T): React.MutableRefObject<T>;
  function useImperativeHandle<T, R extends T>(
    ref: React.Ref<T> | undefined,
    init: () => R,
    deps?: ReadonlyArray<any>
  ): void;
  function useLayoutEffect(
    effect: React.EffectCallback,
    deps?: ReadonlyArray<any>
  ): void;
  function useDebugValue<T>(value: T, format?: (value: T) => any): void;
}

export {};
