import { describe, expect, it } from "vitest";
import manifest from "../../public/manifest.json";

const placeholderPatterns = [
  /id1234567890/i,
  /com\.platochess\.app/i,
  /com\.example\./i,
];

describe("web manifest related_applications", () => {
  it("does not ship placeholder store listing URLs", () => {
    const relatedApplications = manifest.related_applications ?? [];
    for (const app of relatedApplications) {
      const url = app.url ?? "";
      expect(url.length).toBeGreaterThan(0);
      for (const pattern of placeholderPatterns) {
        expect(url).not.toMatch(pattern);
      }
    }
  });
});
