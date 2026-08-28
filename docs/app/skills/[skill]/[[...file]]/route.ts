import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import JSZip from "jszip";

/**
 * Raw serving of the agent skills that live in the repo's `skills/` folder, so
 * a person can tell any agent "read ibcs.at/skills/ibcs-report/SKILL.md and
 * follow it" without installing anything:
 *
 *   /skills/ibcs-notation                → SKILL.md (no HTML page for this one)
 *   /skills/ibcs-report/SKILL.md         → the skill entry, text/markdown
 *   /skills/ibcs-report/references/…     → any reference / script / asset file
 *   /skills/ibcs-report.zip | .skill     → the whole folder as an archive
 *                                          (.skill = the same zip; claude.ai
 *                                          accepts it as an upload)
 *
 * `/skills` and `/skills/ibcs-report` are HTML pages (app/(home)/skills) and
 * take precedence over this handler. Requires `outputFileTracingIncludes` in
 * next.config.mjs so the standalone server bundle carries ../skills.
 */

const SKILLS = ["ibcs-react", "ibcs-notation", "ibcs-report"];
const ROOT = path.join(process.cwd(), "..", "skills");

const TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/plain; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
};

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

async function archive(skill: string, ext: string) {
  if (!SKILLS.includes(skill)) notFound();
  const dir = path.join(ROOT, skill);
  const zip = new JSZip();
  for (const abs of await walk(dir)) {
    const rel = path.relative(dir, abs).split(path.sep).join("/");
    zip.file(`${skill}/${rel}`, await fs.readFile(abs));
  }
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${skill}.${ext}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ skill: string; file?: string[] }> },
) {
  const { skill, file } = await params;

  const asArchive = skill.match(/^(.+)\.(zip|skill)$/);
  if (asArchive && !file) return archive(asArchive[1], asArchive[2]);
  if (!SKILLS.includes(skill)) notFound();

  const rel = (file ?? ["SKILL.md"]).join("/");
  const base = path.join(ROOT, skill);
  const abs = path.normalize(path.join(base, rel));
  if (!abs.startsWith(path.normalize(base) + path.sep)) notFound(); // no traversal

  try {
    const body = await fs.readFile(abs);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": TYPES[path.extname(abs)] ?? "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    notFound();
  }
}
