import { writeFile, rename } from "fs/promises";

// Plain writeFile() truncates the destination immediately, then streams the
// new content in. If two writes race (e.g. two setUserProfile calls fired in
// quick succession, or a process exits mid-write), the file can be left
// truncated or empty rather than holding either version's full content.
// Writing to a temp file and rename()-ing over the destination avoids this:
// rename is atomic on POSIX filesystems, so readers only ever see either the
// old file or a fully-written new one, never a torn write.
export async function atomicWriteFile(path, content) {
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, path);
}
