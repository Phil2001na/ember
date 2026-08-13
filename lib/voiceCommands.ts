/* Local command grammar. Most of what you say mid-cook is one of a dozen short
   phrases; resolving those on-device keeps the common case instant and free,
   and leaves the model for questions that actually need it.

   The matching is deliberately strict — WHOLE utterance, after stripping
   filler, against an exact phrase list. Substring matching would turn
   "how do I know when it's done" into a "next", which is the worst possible
   failure mode here. Anything unrecognised falls through to the model. */

export type VoiceCommand =
  | "next"
  | "back"
  | "repeat"
  | "go"
  | "pause"
  | "resume"
  | "time_left"
  | "detail"
  | "ingredients"
  | "exit";

/** Utterances longer than this are treated as real questions, never commands. */
const MAX_COMMAND_WORDS = 6;

const LEADING_FILLER =
  /^(?:ok(?:ay)?|um+|uh+|er+|so|well|alright|right|yeah|yep|yes|hey|hi|ember|hey ember|ok ember|please|and|now|then)\b[\s,]*/;
const TRAILING_FILLER = /[\s,]*\b(?:please|now|then|ember|thanks|thank you)$/;

const PHRASES: Record<string, VoiceCommand> = {};
function define(command: VoiceCommand, ...phrases: string[]) {
  for (const p of phrases) PHRASES[p] = command;
}

define(
  "next",
  "next", "next step", "next one", "go next", "move on", "moving on",
  "continue", "carry on", "go on", "onwards", "step forward", "forward",
  "done", "im done", "i am done", "that's done", "thats done", "all done",
  "finished", "im finished", "i am finished", "got it", "ready for the next one"
);

define(
  "back",
  "back", "go back", "previous", "previous step", "step back", "last step",
  "one step back", "back a step", "go back a step"
);

define(
  "repeat",
  "repeat", "repeat that", "say that again", "again", "come again", "what",
  "what was that", "one more time", "read that again", "say it again",
  "what's the step", "whats the step", "what step am i on", "where am i"
);

define(
  "go",
  "go", "start", "start it", "start the timer", "start timer", "go ahead",
  "im ready", "i am ready", "ready", "now", "in", "it's in", "its in",
  "it's on", "its on", "that's in", "thats in", "pan's hot", "pans hot"
);

define("pause", "pause", "pause the timer", "pause timer", "hold on", "wait", "stop the timer");
define("resume", "resume", "resume the timer", "resume timer", "unpause", "keep going", "carry on timer");

define(
  "time_left",
  "how long", "how long left", "how much longer", "how much time",
  "how much time left", "time left", "how long is left", "how long to go",
  "what's the time", "whats the time", "how long do i have"
);

define(
  "detail",
  "detail", "details", "more detail", "more details", "tell me more",
  "explain", "explain that", "how do i do that", "more info", "help"
);

define(
  "ingredients",
  "ingredients", "what ingredients", "what do i need", "what do i need again",
  "read the ingredients", "list the ingredients", "shopping list"
);

define(
  "exit",
  "exit", "exit voice", "exit voice mode", "stop voice", "stop listening",
  "quiet", "be quiet", "shut up", "silence", "leave voice mode", "turn off voice"
);

export function normalizeUtterance(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[.,!?;:"“”'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // filler can stack: "ok so, um, next"
  for (let i = 0; i < 3; i++) {
    const stripped = s.replace(LEADING_FILLER, "").replace(TRAILING_FILLER, "").trim();
    if (stripped === s) break;
    // a bare filler word IS the utterance (e.g. "ready", "now") — keep it
    if (!stripped) break;
    s = stripped;
  }
  return s;
}

export function parseVoiceCommand(raw: string): VoiceCommand | null {
  const direct = PHRASES[raw.toLowerCase().replace(/[.,!?]/g, "").trim()];
  if (direct) return direct;

  const s = normalizeUtterance(raw);
  if (!s || s.split(" ").length > MAX_COMMAND_WORDS) return null;
  return PHRASES[s] ?? null;
}
