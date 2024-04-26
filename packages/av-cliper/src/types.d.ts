declare module 'm3u8-parser' {
  export interface Parser {
    push: (content: string) => void;
    end: () => void;
    manifest: {
      allowCache: Boolean;
      segments: Array<{
        duration: number;
        uri: string;
        timeline: number;
        map: {
          uri: string;
        };
      }>;
      version: number;
      targetDuration: number;
      mediaSequence: number;
      discontinuitySequence: number;
      endList: Boolean;
    };
  }

  export const Parser: {
    prototype: Parser;
    new (): Parser;
  };
}
