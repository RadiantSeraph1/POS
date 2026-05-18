import type { PipeflowPosBridge } from "./bridge.ts";

declare global {
  interface Window {
    pipeflowPos: PipeflowPosBridge;
  }
}

export {};
