import { runJapanFireMonteCarlo, type JapanScenarioKey } from "@/domain/forecasting-japan";
import type { ForecastInputs } from "@/domain/types";

// POST /api/forecast/monte-carlo
//
// Body: { inputs: ForecastInputs, scenario?: "bear"|"base"|"bull"|"custom", simulations?: number }
//
// Runs the Japan-FIRE Monte Carlo simulation (500 paths by default, Box-Muller
// sampling, sigma = inputs.returnVolatility or 8%). Kept server-side so the
// browser main thread isn't blocked during the multi-second computation.
export async function POST(request: Request) {
  let body: { inputs?: ForecastInputs; scenario?: JapanScenarioKey; simulations?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const inputs = body.inputs;
  if (!inputs || typeof inputs !== "object") {
    return Response.json({ error: "Request body must include `inputs`." }, { status: 400 });
  }
  const scenario: JapanScenarioKey = body.scenario ?? inputs.activeScenario ?? "base";
  const simulations = Math.max(50, Math.min(2000, Math.round(body.simulations ?? 500)));
  try {
    const result = runJapanFireMonteCarlo(inputs, scenario, simulations);
    return Response.json(result);
  } catch (error) {
    console.error("monte-carlo failed", error);
    return Response.json({ error: "Monte Carlo computation failed." }, { status: 500 });
  }
}
