import { beforeEach, expect, test, vi } from "vitest";

const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile }));

const { concatWithGaps, probeDurationMs, toMp3 } = await import("./ffmpeg");

type Cb = (err: (Error & { code?: string }) | null, stdout: string, stderr: string) => void;
const succeed = (stdout = "") => (_cmd: string, _args: string[], _opts: object, cb: Cb) => cb(null, stdout, "");
const fail = (err: Error & { code?: string }, stderr = "") => (_cmd: string, _args: string[], _opts: object, cb: Cb) =>
  cb(err, "", stderr);

beforeEach(() => {
  execFile.mockReset();
});

test("probe returns milliseconds", async () => {
  execFile.mockImplementation(succeed("12.3456\n"));
  expect(await probeDurationMs("a.mp3")).toBe(12346);
  const [cmd, args] = execFile.mock.calls[0];
  expect(cmd).toBe("ffprobe");
  expect(args).toEqual(["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=duration", "-of", "csv=p=0", "a.mp3"]);
});

test("probe on garbage output: unreadable audio", async () => {
  execFile.mockImplementation(succeed("N/A\n"));
  await expect(probeDurationMs("a.mp3")).rejects.toMatchObject({ code: "invalid" });
});

test("concat pads each input with the gap and concatenates in order", async () => {
  execFile.mockImplementation(succeed());
  await concatWithGaps(["a.mp3", "b.mp3"], 400, "out.mp3");
  const [cmd, args] = execFile.mock.calls[0] as [string, string[]];
  expect(cmd).toBe("ffmpeg");
  expect(args.slice(0, 7)).toEqual(["-y", "-v", "error", "-i", "a.mp3", "-i", "b.mp3"]);
  const filter = args[args.indexOf("-filter_complex") + 1];
  expect(filter).toContain("[0:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur=0.4[a0]");
  expect(filter).toContain("[a0][a1]concat=n=2:v=0:a=1[out]");
  expect(args.at(-1)).toBe("out.mp3");
});

test("no apad when the gap is 0 (apad without a duration pads forever)", async () => {
  execFile.mockImplementation(succeed());
  await concatWithGaps(["a.mp3"], 0, "out.mp3");
  const args = execFile.mock.calls[0][1] as string[];
  expect(args[args.indexOf("-filter_complex") + 1]).not.toContain("apad");
});

test("missing binary: unavailable with a French message", async () => {
  execFile.mockImplementation(fail(Object.assign(new Error("spawn ffprobe ENOENT"), { code: "ENOENT" })));
  await expect(probeDurationMs("a.mp3")).rejects.toMatchObject({ code: "unavailable", message: "ffmpeg est introuvable sur le serveur." });
});

test("toMp3 probes the container first, with a protocol whitelist, before converting", async () => {
  execFile.mockImplementation(succeed("mp3\n"));
  await toMp3("x.mp3", "out.mp3");
  const [probeCmd, probeArgs] = execFile.mock.calls[0] as [string, string[]];
  expect(probeCmd).toBe("ffprobe");
  expect(probeArgs).toEqual([
    "-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=format_name", "-of", "default=nw=1:nk=1", "x.mp3",
  ]);
  const [convertCmd, convertArgs] = execFile.mock.calls[1] as [string, string[]];
  expect(convertCmd).toBe("ffmpeg");
  expect(convertArgs).toEqual([
    "-y", "-v", "error", "-protocol_whitelist", "file", "-i", "x.mp3", "-vn", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", "out.mp3",
  ]);
});

test("toMp3 rejects a disallowed container format (e.g. hls) without ever calling ffmpeg", async () => {
  execFile.mockImplementation(succeed("hls\n"));
  await expect(toMp3("evil.mp3", "out.mp3")).rejects.toMatchObject({ code: "invalid", message: "Ce fichier n'est pas un audio lisible." });
  expect(execFile).toHaveBeenCalledTimes(1);
});

// Régression : -of csv=p=0 quote les listes à virgules ("matroska,webm"), ce qui rejetait tout webm/mkv légitime.
test("toMp3 accepts the unquoted matroska,webm probe output (default=nw=1:nk=1, not csv)", async () => {
  execFile.mockImplementation(succeed("matroska,webm\n"));
  await toMp3("x.webm", "out.mp3");
  expect(execFile).toHaveBeenCalledTimes(2);
});

test("toMp3 on a file ffprobe can't read: invalid", async () => {
  execFile.mockImplementation(fail(new Error("exit 1"), "Invalid data found when processing input"));
  await expect(toMp3("x.txt", "out.mp3")).rejects.toMatchObject({ code: "invalid", message: "Ce fichier n'est pas un audio lisible." });
  expect(execFile).toHaveBeenCalledTimes(1);
});

test("toMp3 conversion failure after a valid container: invalid", async () => {
  execFile.mockImplementationOnce(succeed("wav\n")).mockImplementationOnce(fail(new Error("exit 1"), "encode error"));
  await expect(toMp3("x.wav", "out.mp3")).rejects.toMatchObject({ code: "invalid", message: "Ce fichier n'est pas un audio lisible." });
  expect(execFile).toHaveBeenCalledTimes(2);
});

test("timeout: provider error", async () => {
  execFile.mockImplementation(fail(Object.assign(new Error("killed"), { killed: true, signal: "SIGKILL" })));
  await expect(probeDurationMs("a.mp3")).rejects.toMatchObject({
    code: "provider",
    message: "Le traitement audio a pris trop de temps.",
  });
  const [, , opts] = execFile.mock.calls[0] as [string, string[], { timeout: number; killSignal: string }];
  expect(opts.timeout).toBe(30_000);
  expect(opts.killSignal).toBe("SIGKILL");
});

test("generic non-ENOENT failure: provider error", async () => {
  execFile.mockImplementation(fail(new Error("exit 1"), "some ffprobe error"));
  await expect(probeDurationMs("a.mp3")).rejects.toMatchObject({
    code: "provider",
    message: "Le traitement audio a échoué.",
  });
});
