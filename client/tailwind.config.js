function withOpacity(variableName) {
  return ({ opacityVariable, opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    if (opacityVariable !== undefined) {
      return `rgba(var(${variableName}), var(${opacityVariable}, 1))`;
    }
    return `rgb(var(${variableName}))`;
  };
}

// tailwind.config.js
export default {
  mode: "jit",
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],

  theme: {
    extend: {
      colors: {
        primary: withOpacity("--color-primary-rgb"),
        primaryAlt: withOpacity("--color-primaryAlt-rgb"),
        secondary: withOpacity("--color-secondary-rgb"),
        secondaryAlt: withOpacity("--color-secondaryAlt-rgb"),
        accent: withOpacity("--color-accent-rgb"),
        neutral: withOpacity("--color-neutral-rgb"),
        neutralAlt: withOpacity("--color-neutralAlt-rgb"),
        error: withOpacity("--color-error-rgb"),
        "base-100": withOpacity("--color-base-100-rgb"),
        "base-100Alt": withOpacity("--color-base-100-rgb"),
      },
      spacing: {
        15: "3.75rem",
      },
      width: {
        90: "21.5rem",
      },
      height: {
        "d-screen": "100dvh",
        "s-screen": "100svh",
      },
      fontSize: {
        // ~13px
        sm: ["0.8125rem", { lineHeight: "1.5" }],
        // 14px
        base: ["0.875rem", { lineHeight: "1.5" }],
        // 16px
        lg: ["1rem", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};
