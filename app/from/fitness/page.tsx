import { parseNutritionIntent } from "@/lib/fitnessHandoff";
import FromFitnessClient from "./FromFitnessClient";

export default async function FromFitnessPage({ searchParams }: PageProps<"/from/fitness">) {
  const params = await searchParams;
  const result = parseNutritionIntent(params);

  return (
    <FromFitnessClient intent={result.ok ? result.intent : null} errorReason={result.ok ? null : result.reason} />
  );
}
