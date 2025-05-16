// This file provides global JSX declarations for TypeScript
// It enables use of all HTML elements in React components without needing to declare them individually

import * as React from "react";

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicElements {
      // Core HTML elements
      div: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
      >;
      span: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLSpanElement>,
        HTMLSpanElement
      >;
      img: React.DetailedHTMLProps<
        React.ImgHTMLAttributes<HTMLImageElement>,
        HTMLImageElement
      >;
      a: React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >;
      p: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLParagraphElement>,
        HTMLParagraphElement
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
      button: React.DetailedHTMLProps<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        HTMLButtonElement
      >;
      input: React.DetailedHTMLProps<
        React.InputHTMLAttributes<HTMLInputElement>,
        HTMLInputElement
      >;
      textarea: React.DetailedHTMLProps<
        React.TextareaHTMLAttributes<HTMLTextAreaElement>,
        HTMLTextAreaElement
      >;
      select: React.DetailedHTMLProps<
        React.SelectHTMLAttributes<HTMLSelectElement>,
        HTMLSelectElement
      >;
      form: React.DetailedHTMLProps<
        React.FormHTMLAttributes<HTMLFormElement>,
        HTMLFormElement
      >;
      label: React.DetailedHTMLProps<
        React.LabelHTMLAttributes<HTMLLabelElement>,
        HTMLLabelElement
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
      footer: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      canvas: React.DetailedHTMLProps<
        React.CanvasHTMLAttributes<HTMLCanvasElement>,
        HTMLCanvasElement
      >;
      // Include any other specific elements you need

      // Fallback for any other HTML elements
      [elemName: string]: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
