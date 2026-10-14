import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET } from "@/app/api/public/avatar/[file]/route";
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

describe("Public Avatar API Route GET /api/public/avatar/[file]", () => {
  const testDir = path.join(process.cwd(), "storage", "avatars");
  const testFileName = "test-sample-avatar.jpg";
  const testFilePath = path.join(testDir, testFileName);

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFilePath, Buffer.from("fake-jpeg-binary-data"));
  });

  afterAll(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch {
      // ignore
    }
  });

  it("serves an existing avatar with correct MIME and immutable cache headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/public/avatar/" + testFileName);
    const res = await GET(req, { params: Promise.resolve({ file: testFileName }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("returns 404 for a file that does not exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/public/avatar/non-existent-photo.jpg");
    const res = await GET(req, { params: Promise.resolve({ file: "non-existent-photo.jpg" }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects path traversal attempts with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/public/avatar/..%2Fsecret.env");
    const res = await GET(req, { params: Promise.resolve({ file: "../secret.env" }) });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
