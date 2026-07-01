import { describe, it, expect } from "vitest";

import {
  mapPostType,
  parseJwtExpiry,
  getVideoExpiry,
  MUX_HLS_RE,
  MUX_MP4_RE,
  extractVideoFromEmbed,
  extractVideoFromIncluded,
} from "../patreon";

// ─── mapPostType ──────────────────────────────────────

describe("mapPostType", () => {
  it('maps "video" to VIDEO', () => {
    expect(mapPostType("video")).toBe("VIDEO");
  });

  it('maps "video_embed" to VIDEO', () => {
    expect(mapPostType("video_embed")).toBe("VIDEO");
  });

  it('maps "video_external_file" to VIDEO', () => {
    expect(mapPostType("video_external_file")).toBe("VIDEO");
  });

  it('maps "image" to IMAGE', () => {
    expect(mapPostType("image")).toBe("IMAGE");
  });

  it('maps "image_file" to IMAGE', () => {
    expect(mapPostType("image_file")).toBe("IMAGE");
  });

  it('maps "audio", "audio_file", "audio_embed" to AUDIO', () => {
    expect(mapPostType("audio")).toBe("AUDIO");
    expect(mapPostType("audio_file")).toBe("AUDIO");
    expect(mapPostType("audio_embed")).toBe("AUDIO");
  });

  it('maps "link" to LINK', () => {
    expect(mapPostType("link")).toBe("LINK");
  });

  it('maps "file" to FILE', () => {
    expect(mapPostType("file")).toBe("FILE");
  });

  it("maps undefined to TEXT", () => {
    expect(mapPostType(undefined)).toBe("TEXT");
  });

  it("maps unknown types to TEXT", () => {
    expect(mapPostType("unknown_type")).toBe("TEXT");
    expect(mapPostType("poll")).toBe("TEXT");
    expect(mapPostType("")).toBe("TEXT");
  });
});

// ─── parseJwtExpiry ────────────────────────────────────

describe("parseJwtExpiry", () => {
  function createJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = Buffer.from("fake-signature").toString("base64url");
    return `${header}.${body}.${sig}`;
  }

  it("returns Date with 5-min buffer from valid exp claim", () => {
    const token = createJwt({ exp: 3600 });
    const result = parseJwtExpiry(token);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe((3600 - 300) * 1000);
  });

  it("returns null for token without exp claim", () => {
    const token = createJwt({ sub: "test" });
    expect(parseJwtExpiry(token)).toBeNull();
  });

  it("returns null for non-numeric exp", () => {
    const token = createJwt({ exp: "far-future" });
    expect(parseJwtExpiry(token)).toBeNull();
  });

  it("returns null for invalid token (no dots)", () => {
    expect(parseJwtExpiry("not-a-jwt")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(parseJwtExpiry("a.!!!.c")).toBeNull();
  });

  it("handles future expiry correctly with buffer", () => {
    const future = Math.floor(Date.now() / 1000) + 7200;
    const token = createJwt({ exp: future });
    const result = parseJwtExpiry(token);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe((future - 300) * 1000);
  });
});

// ─── getVideoExpiry ────────────────────────────────────

describe("getVideoExpiry", () => {
  function createJwtToken(exp: number): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    const sig = Buffer.from("fake-signature").toString("base64url");
    return `${header}.${body}.${sig}`;
  }

  it("returns expiry from JWT token in URL", () => {
    const token = createJwtToken(5000);
    const url = `https://stream.mux.com/video.m3u8?token=${token}`;
    const result = getVideoExpiry(url);
    expect(result.getTime()).toBe((5000 - 300) * 1000);
  });

  it("falls back to 24h for URLs without token", () => {
    const url = "https://stream.mux.com/video.m3u8";
    const before = Date.now();
    const result = getVideoExpiry(url);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 100);
    expect(result.getTime()).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100);
  });

  it("falls back to 24h for invalid URLs", () => {
    const result = getVideoExpiry("invalid-url");
    const expected = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
  });
});

// ─── Regex patterns ────────────────────────────────────

describe("MUX_HLS_RE", () => {
  it("matches valid signed Mux HLS URLs", () => {
    const url = "https://stream.mux.com/abc123.m3u8?token=eyJhbGciOiJIUzI1NiJ9.dGVzdA.signature";
    expect(url.match(MUX_HLS_RE)).toBeTruthy();
    expect(url.match(MUX_HLS_RE)![0]).toBe(url);
  });

  it("matches HLS URLs with hyphens and underscores in ID", () => {
    const url = "https://stream.mux.com/aBc-123_XYZ.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature";
    expect(url.match(MUX_HLS_RE)).toBeTruthy();
  });

  it("does not match non-Mux URLs", () => {
    expect("https://example.com/video.m3u8".match(MUX_HLS_RE)).toBeNull();
  });

  it("does not match URLs without token", () => {
    expect("https://stream.mux.com/video.m3u8".match(MUX_HLS_RE)).toBeNull();
  });
});

describe("MUX_MP4_RE", () => {
  it("matches valid signed Mux MP4 URLs", () => {
    const url = "https://stream.mux.com/abc123/1080p.mp4?token=eyJhbGciOiJIUzI1NiJ9.dGVzdA.signature";
    expect(url.match(MUX_MP4_RE)).toBeTruthy();
    expect(url.match(MUX_MP4_RE)![0]).toBe(url);
  });

  it("matches MP4 URLs with quality names", () => {
    const url = "https://stream.mux.com/abc123/high.mp4?token=eyJ0eXAiOiJKV1QiLA.signature";
    expect(url.match(MUX_MP4_RE)).toBeTruthy();
  });

  it("does not match non-Mux URLs", () => {
    expect("https://example.com/video.mp4?token=abc".match(MUX_MP4_RE)).toBeNull();
  });

  it("does not match HLS URLs", () => {
    const url = "https://stream.mux.com/abc123.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature";
    expect(url.match(MUX_MP4_RE)).toBeNull();
  });
});

// ─── extractVideoFromEmbed ─────────────────────────────

describe("extractVideoFromEmbed", () => {
  it("returns null for null input", () => {
    expect(extractVideoFromEmbed(null)).toBeNull();
  });

  it("returns null for embed without video URL", () => {
    const html = "<div>Some embed content</div>";
    expect(extractVideoFromEmbed(html)).toBeNull();
  });

  it("extracts signed HLS URL from embed HTML", () => {
    const html =
      '<iframe src="https://player.vimeo.com/video/123"></iframe>\n' +
      '      <script src="https://stream.mux.com/abc123.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature"></script>';
    const result = extractVideoFromEmbed(html);
    expect(result).toEqual({
      url: "https://stream.mux.com/abc123.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature",
      isHls: true,
    });
  });

  it("extracts signed MP4 URL from embed HTML", () => {
    const html =
      '<video src="https://stream.mux.com/abc123/1080p.mp4?token=eyJ0eXAiOiJKV1QiLA.signature"></video>';
    const result = extractVideoFromEmbed(html);
    expect(result).toEqual({
      url: "https://stream.mux.com/abc123/1080p.mp4?token=eyJ0eXAiOiJKV1QiLA.signature",
      isHls: false,
    });
  });

  it("prioritizes HLS over MP4 when both are present", () => {
    const html =
      "HLS: https://stream.mux.com/abc123.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature\n" +
      "      MP4: https://stream.mux.com/abc123/1080p.mp4?token=eyJ0eXAiOiJKV1QiLA.signature";
    const result = extractVideoFromEmbed(html);
    expect(result!.isHls).toBe(true);
  });

  it("extracts plain .m3u8 URL as fallback", () => {
    const html = "https://cdn.example.com/video.m3u8?token=abc";
    const result = extractVideoFromEmbed(html);
    expect(result).toEqual({
      url: "https://cdn.example.com/video.m3u8?token=abc",
      isHls: true,
    });
  });
});

// ─── extractVideoFromIncluded ──────────────────────────

describe("extractVideoFromIncluded", () => {
  const makeIncluded = (overrides: Record<string, unknown> = {}) => [
    {
      id: "media-1",
      type: "media",
      attributes: {
        mimetype: "",
        download_url: "",
        stream_url: "",
        ...overrides,
      },
    },
  ];

  it("returns null for empty included array", () => {
    expect(extractVideoFromIncluded([])).toBeNull();
  });

  it("extracts HLS from display field (string)", () => {
    const included = makeIncluded({
      display:
        "https://stream.mux.com/abc123.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature",
    });
    const result = extractVideoFromIncluded(included);
    expect(result).toEqual({
      url: "https://stream.mux.com/abc123.m3u8?token=eyJ0eXAiOiJKV1QiLA.signature",
      isHls: true,
    });
  });

  it("extracts MP4 from display field (object)", () => {
    const included = makeIncluded({
      display: {
        url: "https://stream.mux.com/abc123/720p.mp4?token=eyJ0eXAiOiJKV1QiLA.signature",
      },
    });
    const result = extractVideoFromIncluded(included);
    expect(result).toEqual({
      url: "https://stream.mux.com/abc123/720p.mp4?token=eyJ0eXAiOiJKV1QiLA.signature",
      isHls: false,
    });
  });

  it("extracts from download_url when mimetype indicates HLS", () => {
    const included = makeIncluded({
      mimetype: "application/x-mpegURL",
      download_url: "https://stream.mux.com/abc123.m3u8?token=xyz",
    });
    const result = extractVideoFromIncluded(included);
    expect(result).toEqual({
      url: "https://stream.mux.com/abc123.m3u8?token=xyz",
      isHls: true,
    });
  });

  it("extracts from stream_url with .m3u8", () => {
    const included = makeIncluded({
      stream_url: "https://stream.mux.com/abc123.m3u8?token=xyz",
    });
    const result = extractVideoFromIncluded(included);
    expect(result).toEqual({
      url: "https://stream.mux.com/abc123.m3u8?token=xyz",
      isHls: true,
    });
  });

  it("extracts from urls object", () => {
    const included = makeIncluded({
      urls: {
        high: "https://stream.mux.com/abc123.m3u8?token=xyz",
        low: "https://stream.mux.com/abc456.m3u8?token=abc",
      },
    });
    const result = extractVideoFromIncluded(included);
    expect(result).toBeTruthy();
    expect(result!.isHls).toBe(true);
  });

  it("returns MP4 when it comes before HLS in candidates (first-match order)", () => {
    // candidates = [download_url, stream_url], so MP4 in download_url is checked first
    const included = makeIncluded({
      download_url: "https://stream.mux.com/abc123.mp4?token=xyz",
      stream_url: "https://stream.mux.com/abc123.m3u8?token=xyz",
    });
    const result = extractVideoFromIncluded(included);
    // download_url (mp4) is processed first in the candidates loop
    expect(result!.isHls).toBe(false);
  });

  it("skips non-mux.com URLs", () => {
    const included = makeIncluded({
      download_url: "https://cdn.example.com/video.mp4",
    });
    expect(extractVideoFromIncluded(included)).toBeNull();
  });
});
