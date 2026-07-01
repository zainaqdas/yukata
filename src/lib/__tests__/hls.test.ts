import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitHlsUrl, getActiveHlsUrl, getExpiredHlsMedia, markHlsExpired, getAllVideos } from "../hls";

// ─── Mock Prisma ───────────────────────────────────────

const mockMediaCreate = vi.fn();
const mockMediaFindFirst = vi.fn();
const mockMediaFindMany = vi.fn();
const mockMediaUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    media: {
      create: (...args: unknown[]) => mockMediaCreate(...args),
      findFirst: (...args: unknown[]) => mockMediaFindFirst(...args),
      findMany: (...args: unknown[]) => mockMediaFindMany(...args),
      update: (...args: unknown[]) => mockMediaUpdate(...args),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── submitHlsUrl ──────────────────────────────────────

describe("submitHlsUrl", () => {
  it("creates new media record when none exists", async () => {
    mockMediaFindFirst.mockResolvedValue(null);
    mockMediaCreate.mockResolvedValue({
      id: "new-media-1",
      postId: "post-1",
      type: "HLS_VIDEO",
      hlsManifestUrl: "https://stream.mux.com/video.m3u8?token=abc",
    });

    const result = await submitHlsUrl("post-1", "https://stream.mux.com/video.m3u8?token=abc", 120);

    expect(mockMediaFindFirst).toHaveBeenCalledWith({
      where: { postId: "post-1", type: "HLS_VIDEO" },
    });
    expect(mockMediaCreate).toHaveBeenCalledOnce();
    expect(result.hlsManifestUrl).toBe("https://stream.mux.com/video.m3u8?token=abc");
  });

  it("updates existing media record", async () => {
    mockMediaFindFirst.mockResolvedValue({ id: "existing-1", postId: "post-1" });
    mockMediaUpdate.mockResolvedValue({
      id: "existing-1",
      postId: "post-1",
      hlsManifestUrl: "https://stream.mux.com/new.m3u8?token=xyz",
    });

    const result = await submitHlsUrl("post-1", "https://stream.mux.com/new.m3u8?token=xyz", 60);

    expect(mockMediaUpdate).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: expect.objectContaining({
        hlsManifestUrl: "https://stream.mux.com/new.m3u8?token=xyz",
      }),
    });
    expect(mockMediaCreate).not.toHaveBeenCalled();
    expect(result.hlsManifestUrl).toBe("https://stream.mux.com/new.m3u8?token=xyz");
  });

  it("uses default duration of 120 minutes", async () => {
    mockMediaFindFirst.mockResolvedValue(null);
    mockMediaCreate.mockResolvedValue({ id: "new" });

    await submitHlsUrl("post-1", "https://stream.mux.com/video.m3u8?token=abc");

    const createCall = mockMediaCreate.mock.calls[0][0];
    const expiresAt = createCall.data.hlsExpiresAt;
    const expected = Date.now() + 120 * 60 * 1000;
    expect(Math.abs(expiresAt.getTime() - expected)).toBeLessThan(100);
  });
});

// ─── getActiveHlsUrl ───────────────────────────────────

describe("getActiveHlsUrl", () => {
  it("returns active HLS media", async () => {
    const mockMedia = {
      id: "media-1",
      postId: "post-1",
      hlsManifestUrl: "https://stream.mux.com/video.m3u8?token=abc",
      hlsExpiresAt: new Date(Date.now() + 3600000),
    };
    mockMediaFindFirst.mockResolvedValue(mockMedia);

    const result = await getActiveHlsUrl("post-1");

    expect(mockMediaFindFirst).toHaveBeenCalledWith({
      where: {
        postId: "post-1",
        type: "HLS_VIDEO",
        hlsManifestUrl: { not: null },
        hlsExpiresAt: { gt: expect.any(Date) },
      },
      orderBy: { hlsRefreshedAt: "desc" },
    });
    expect(result).toEqual(mockMedia);
  });

  it("returns null when no active HLS media", async () => {
    mockMediaFindFirst.mockResolvedValue(null);
    const result = await getActiveHlsUrl("post-1");
    expect(result).toBeNull();
  });
});

// ─── getExpiredHlsMedia ────────────────────────────────

describe("getExpiredHlsMedia", () => {
  beforeEach(() => {
    delete process.env.HLS_REFRESH_INTERVAL_MINUTES;
  });

  it("uses default 30-min buffer when env var not set", async () => {
    mockMediaFindMany.mockResolvedValue([]);

    await getExpiredHlsMedia();

    const callArgs = mockMediaFindMany.mock.calls[0][0];
    const threshold = callArgs.where.hlsExpiresAt.lte;
    const expectedMin = Date.now() + 30 * 60 * 1000;
    expect(Math.abs(threshold.getTime() - expectedMin)).toBeLessThan(100);
  });

  it("uses env var buffer when set", async () => {
    process.env.HLS_REFRESH_INTERVAL_MINUTES = "60";
    mockMediaFindMany.mockResolvedValue([]);

    await getExpiredHlsMedia();

    const callArgs = mockMediaFindMany.mock.calls[0][0];
    const threshold = callArgs.where.hlsExpiresAt.lte;
    const expected = Date.now() + 60 * 60 * 1000;
    expect(Math.abs(threshold.getTime() - expected)).toBeLessThan(100);
  });

  it("falls back to 30 for invalid env var value", async () => {
    process.env.HLS_REFRESH_INTERVAL_MINUTES = "not-a-number";
    mockMediaFindMany.mockResolvedValue([]);

    await getExpiredHlsMedia();

    const callArgs = mockMediaFindMany.mock.calls[0][0];
    const threshold = callArgs.where.hlsExpiresAt.lte;
    const expected = Date.now() + 30 * 60 * 1000;
    expect(Math.abs(threshold.getTime() - expected)).toBeLessThan(100);
  });

  it("includes post relation in query", async () => {
    const mockExpired = [
      { id: "m1", postId: "p1", post: { title: "Test Post", patreonId: "patreon-1" } },
    ];
    mockMediaFindMany.mockResolvedValue(mockExpired);

    const result = await getExpiredHlsMedia();

    const callArgs = mockMediaFindMany.mock.calls[0][0];
    expect(callArgs.include).toEqual({ post: { select: { title: true, patreonId: true } } });
    expect(result).toEqual(mockExpired);
  });
});

// ─── markHlsExpired ────────────────────────────────────

describe("markHlsExpired", () => {
  it("updates hlsExpiresAt to a past date", async () => {
    mockMediaUpdate.mockResolvedValue({ id: "media-1" });

    const result = await markHlsExpired("media-1");

    const updateCall = mockMediaUpdate.mock.calls[0][0];
    expect(updateCall.where.id).toBe("media-1");
    expect(updateCall.data.hlsExpiresAt.getTime()).toBeLessThan(Date.now());
    expect(result).toEqual({ id: "media-1" });
  });
});

// ─── getAllVideos ──────────────────────────────────────

describe("getAllVideos", () => {
  it("returns all HLS video media ordered by creation date", async () => {
    const mockVideos = [
      { id: "v1", post: { title: "Video 1" } },
      { id: "v2", post: { title: "Video 2" } },
    ];
    mockMediaFindMany.mockResolvedValue(mockVideos);

    const result = await getAllVideos();

    expect(mockMediaFindMany).toHaveBeenCalledWith({
      where: {
        type: "HLS_VIDEO",
        OR: [
          { hlsExpiresAt: null },
          { hlsExpiresAt: { gt: expect.any(Date) } },
        ],
      },
      include: { post: { select: { title: true, thumbnailUrl: true, publishedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual(mockVideos);
  });

  it("returns empty array when no videos exist", async () => {
    mockMediaFindMany.mockResolvedValue([]);
    const result = await getAllVideos();
    expect(result).toEqual([]);
  });
});
