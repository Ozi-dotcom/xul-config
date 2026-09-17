declare global {
  interface Window {
    /**
     * Navigate to the auth page with a custom redirect URL
     * @param redirectUrl - URL to redirect to after successful authentication
     */
    navigateToAuth: (redirectUrl: string) => void;
  }
}

export {};

// Web Serial API (not in TS DOM lib yet) — used to send config JSON to the Arduino.
interface SerialPort {
  open(options?: { baudRate?: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: {
    getWriter(): {
      write(chunk: Uint8Array): Promise<void>;
      releaseLock(): void;
    };
  };
}

declare global {
  interface Navigator {
    readonly serial?: {
      requestPort(options?: {
        filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
      }): Promise<SerialPort>;
    };
  }
}