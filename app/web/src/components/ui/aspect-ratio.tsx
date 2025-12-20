import * as React from "react";

export interface AspectRatioProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ ratio = 16 / 9, style, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: `${100 / ratio}%`,
          ...style,
        }}
        {...props}
      >
        <div
          className={className}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);

AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
