export type HomeNudge = {
  text: string;
  prompt: string;
};

type PantrySummary = { name: string; quantity_text: string | null };

export function homeNudge(hour: number, pantry: PantrySummary[], dayOfYear: number): HomeNudge {
  if (!pantry.length) {
    return {
      text: "Give me one messy list of what’s in your kitchen. I’ll remember the useful bits.",
      prompt: "Let me tell you what I have in my kitchen.",
    };
  }

  const runningLow = pantry.find((item) =>
    /almost|low|little|last|half|nearly|small amount/i.test(item.quantity_text ?? "")
  );
  if (runningLow) {
    return {
      text: `Your ${runningLow.name} sounds like it’s running low. I can use it up before it disappears.`,
      prompt: `Make me something that uses up my ${runningLow.name}.`,
    };
  }

  const evening = hour >= 17 || hour < 4;
  const options: HomeNudge[] = evening
    ? [
        { text: "Low energy tonight? Give me an effort level and I’ll handle the rest.", prompt: "I’m low energy. Pick something easy for me." },
        { text: "Cooking to impress tonight? I’ll make what you have feel special.", prompt: "I’m cooking to impress tonight. What should I make?" },
        { text: "Don’t feel like deciding? Give me the mood—or let me choose completely.", prompt: "Choose dinner for me. I don’t want to think." },
      ]
    : [
        { text: "Short on time? Tell me when you need to eat and I’ll work backwards.", prompt: "I need something quick. Choose for me." },
        { text: "Cheap, healthy, comforting, impressive—give me the mood and I’ll choose.", prompt: "Show me something comforting from what I have." },
        { text: "I can build something around one ingredient you feel like eating.", prompt: "Help me choose one ingredient to build a meal around." },
      ];

  return options[dayOfYear % options.length];
}
