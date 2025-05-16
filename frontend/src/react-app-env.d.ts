/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="react/jsx-runtime" />

declare namespace JSX {
  interface IntrinsicElements {
    div: any;
    span: any;
    h1: any;
    h2: any;
    h3: any;
    p: any;
    a: any;
    button: any;
    img: any;
    input: any;
    label: any;
    header: any;
    nav: any;
    main: any;
    svg: any;
    path: any;
    br: any;
    // Add other elements as needed
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
      React.HTMLAttributes<HTMLOListElement>,
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
    tr: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLTableRowElement>,
      HTMLTableRowElement
    >;
    td: React.DetailedHTMLProps<
      React.TdHTMLAttributes<HTMLTableCellElement>,
      HTMLTableCellElement
    >;
    th: React.DetailedHTMLProps<
      React.ThHTMLAttributes<HTMLTableCellElement>,
      HTMLTableCellElement
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
  }
}
