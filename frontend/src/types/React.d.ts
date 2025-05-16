/// <reference types="react" />
/// <reference types="react-dom" />

declare namespace React {
  namespace JSX {
    // The JSX.Element type represents the return value of a JSX expression
    interface Element extends React.ReactElement<any, any> {}

    // ElementClass refers to the class a component must inherit from to be used in JSX
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }

    // ElementAttributesProperty specifies the property on a component that contains the props
    interface ElementAttributesProperty {
      props: {};
    }

    // ElementChildrenAttribute specifies the property on a component that contains the children
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}
