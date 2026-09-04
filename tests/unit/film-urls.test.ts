import { describe, expect, it } from "vitest";
import { clock, parseClock, parseFilmUrl } from "../../src/lib/film/urls";

describe("film links", () => {
  it("reads every YouTube form into one embed", () => {
    const forms = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=12",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=abc",
      "www.youtube.com/watch?v=dQw4w9WgXcQ",
    ];
    for (const f of forms) {
      const p = parseFilmUrl(f);
      expect(p?.source, f).toBe("youtube");
      expect(p?.id, f).toBe("dQw4w9WgXcQ");
      expect(p?.embedUrl, f).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
      expect(p?.canonical, f).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }
  });

  it("keeps a Veo match link as veo with its match id and no embed", () => {
    const p = parseFilmUrl("https://app.veo.co/matches/20260829-belstone-v-spelthorne-abc123/");
    expect(p?.source).toBe("veo");
    expect(p?.id).toBe("20260829-belstone-v-spelthorne-abc123");
    expect(p?.embedUrl).toBeNull();
    const clip = parseFilmUrl("https://app.veo.co/matches/m1/clips/c9/");
    expect(clip?.id).toBe("m1");
  });

  it("rejects rubbish and non-http schemes, and keeps other links as links", () => {
    expect(parseFilmUrl("")).toBeNull();
    expect(parseFilmUrl("not a link at all")).toBeNull();
    expect(parseFilmUrl("javascript:alert(1)")).toBeNull();
    expect(parseFilmUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseFilmUrl("https://example.com/film.mp4")?.source).toBe("other");
  });

  it("reads and writes the clock", () => {
    expect(clock(312)).toBe("5:12");
    expect(clock(3725)).toBe("1:02:05");
    expect(clock(7)).toBe("0:07");
    expect(parseClock("5:12")).toBe(312);
    expect(parseClock("1:02:05")).toBe(3725);
    expect(parseClock("312")).toBe(312);
    expect(parseClock("five")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});
