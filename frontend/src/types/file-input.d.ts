interface HTMLInputElement {
  webkitdirectory: boolean;
  directory: boolean;
}

// Extend the InputHTMLAttributes interface to include webkitdirectory and directory
declare namespace React {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: boolean | string;
    directory?: boolean | string;
  }
}
