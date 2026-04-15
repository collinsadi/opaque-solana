import { useState, useRef } from "react";
import { DEMO_CONFIG } from "./config";
import { verifyProof, VerifyResult } from "./verifier";
import { StepBadge } from "./components/StepBadge";

type Step = 1 | 2 | 3;

interface SuccessData {
  nullifierHash: string;
  schemaId: string;
  merkleRoot: string;
}

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [proofText, setProofText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleVerify() {
    if (!proofText.trim()) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await verifyProof(proofText.trim());
      setResult(res);
      if (res.ok) {
        setSuccessData({
          nullifierHash: res.nullifierHash,
          schemaId: res.schemaId,
          merkleRoot: res.merkleRoot,
        });
        setStep(3);
      }
    } finally {
      setVerifying(false);
    }
  }

  function handleReset() {
    setStep(1);
    setProofText("");
    setResult(null);
    setSuccessData(null);
  }

  return (
    <div className="min-h-screen bg-ink-900 text-mist flex flex-col">
      {/* Header */}
      <header className="border-b border-ink-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-sol-purple/20 border border-sol-purple/40 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-sol-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">{DEMO_CONFIG.APP_NAME}</span>
        </div>
        <span className="text-xs text-ink-500 font-mono">Opaque Protocol · ZK-Gated</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-6">

          {/* Step indicators */}
          <div className="flex items-center gap-3">
            {([1, 2, 3] as Step[]).map((n, i, arr) => (
              <div key={n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <StepBadge number={n} active={step === n} done={step > n} />
                  <span className={`text-xs ${step === n ? "text-mist" : step > n ? "text-sol-green" : "text-ink-500"}`}>
                    {n === 1 ? "Get Proof" : n === 2 ? "Verify" : "Access"}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-px w-10 ${step > n ? "bg-sol-green/40" : "bg-ink-700"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1 — Instructions */}
          {step === 1 && (
            <div className="rounded-xl border border-ink-700 bg-ink-800 divide-y divide-ink-700">
              <div className="p-5 space-y-1">
                <h2 className="font-semibold text-base">Generate a ZK Proof</h2>
                <p className="text-sm text-ink-400">
                  Use the Opaque frontend to generate a Groth16 proof for your attestation.
                  You must use the external nullifier below — it binds your proof to this app.
                </p>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-xs uppercase tracking-widest text-ink-500 font-semibold">Required external nullifier</p>
                <div className="flex items-center gap-3 rounded-lg bg-ink-900 border border-ink-700 px-4 py-3">
                  <span className="font-mono text-lg text-sol-purple flex-1">{DEMO_CONFIG.EXTERNAL_NULLIFIER}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(DEMO_CONFIG.EXTERNAL_NULLIFIER)}
                    className="text-xs text-ink-500 hover:text-mist transition-colors px-2 py-1 rounded border border-ink-700 hover:border-ink-500"
                  >
                    Copy
                  </button>
                </div>
                {DEMO_CONFIG.REQUIRED_SCHEMA_ID && (
                  <div className="rounded-lg bg-sol-purple/5 border border-sol-purple/20 px-4 py-3 space-y-1">
                    <p className="text-xs text-sol-purple font-semibold uppercase tracking-widest">Required Schema</p>
                    <p className="font-mono text-xs text-mist break-all">{DEMO_CONFIG.REQUIRED_SCHEMA_ID}</p>
                  </div>
                )}
              </div>

              <div className="p-5">
                <ol className="space-y-2 text-sm text-ink-400 list-decimal list-inside">
                  <li>Open the Opaque app and go to <span className="text-mist">My Traits</span></li>
                  <li>Find your attestation and click <span className="text-mist">Generate Proof</span></li>
                  <li>Enter <span className="font-mono text-sol-purple">{DEMO_CONFIG.EXTERNAL_NULLIFIER}</span> as the external nullifier</li>
                  <li>Click <span className="text-mist">Generate</span> and copy the full JSON output</li>
                </ol>
              </div>

              <div className="p-5">
                <button
                  onClick={() => setStep(2)}
                  className="w-full rounded-lg bg-sol-purple hover:bg-sol-purple/90 text-white text-sm font-semibold py-2.5 transition-colors"
                >
                  I have my proof &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Paste & verify */}
          {step === 2 && (
            <div className="rounded-xl border border-ink-700 bg-ink-800 divide-y divide-ink-700">
              <div className="p-5 space-y-1">
                <h2 className="font-semibold text-base">Paste Your Proof</h2>
                <p className="text-sm text-ink-400">
                  Paste the full JSON proof object generated by the Opaque app.
                </p>
              </div>

              <div className="p-5">
                <textarea
                  ref={textareaRef}
                  value={proofText}
                  onChange={(e) => {
                    setProofText(e.target.value);
                    setResult(null);
                  }}
                  placeholder='{ "proof": { "pi_a": [...], ... }, "publicSignals": [...], ... }'
                  rows={9}
                  className="w-full rounded-lg bg-ink-900 border border-ink-700 focus:border-sol-purple/60 outline-none px-4 py-3 font-mono text-xs text-mist placeholder-ink-600 resize-none transition-colors"
                  spellCheck={false}
                />

                {result && !result.ok && (
                  <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 flex gap-3">
                    <svg className="h-4 w-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <p className="text-sm text-red-300">{result.reason}</p>
                  </div>
                )}
              </div>

              <div className="p-5 flex gap-3">
                <button
                  onClick={() => { setStep(1); setResult(null); }}
                  className="rounded-lg border border-ink-600 bg-ink-800 hover:bg-ink-700 text-sm text-ink-400 hover:text-mist px-4 py-2.5 transition-colors"
                >
                  &larr; Back
                </button>
                <button
                  onClick={handleVerify}
                  disabled={!proofText.trim() || verifying}
                  className="flex-1 rounded-lg bg-sol-purple hover:bg-sol-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Verifying…
                    </>
                  ) : (
                    "Verify Proof"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Gated content */}
          {step === 3 && successData && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="rounded-xl border border-sol-green/30 bg-sol-green/5 p-5 flex gap-4">
                <div className="h-9 w-9 shrink-0 rounded-full bg-sol-green/20 flex items-center justify-center">
                  <svg className="h-5 w-5 text-sol-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sol-green text-sm">Proof verified</p>
                  <p className="text-xs text-ink-400 mt-0.5">Your attestation is valid. Access granted.</p>
                </div>
              </div>

              {/* Proof metadata */}
              <div className="rounded-xl border border-ink-700 bg-ink-800 divide-y divide-ink-700">
                <div className="px-5 py-4">
                  <p className="text-xs uppercase tracking-widest text-ink-500 font-semibold">Proof Details</p>
                </div>
                {[
                  { label: "Nullifier Hash", value: successData.nullifierHash },
                  { label: "Schema ID", value: successData.schemaId },
                  { label: "Merkle Root", value: successData.merkleRoot },
                ].map(({ label, value }) => (
                  <div key={label} className="px-5 py-3 space-y-1">
                    <p className="text-xs text-ink-500">{label}</p>
                    <p className="font-mono text-xs text-mist break-all">{value}</p>
                  </div>
                ))}
              </div>

              {/* Gated content placeholder */}
              <div className="rounded-xl border border-ink-700 bg-ink-800 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-sol-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-semibold">Members Area</span>
                </div>
                <p className="text-sm text-ink-400">
                  This is the gated content. Replace this section with whatever your application
                  should show to verified attestation holders.
                </p>
                <div className="rounded-lg bg-ink-900 border border-ink-700 px-4 py-3 text-xs font-mono text-ink-400">
                  <span className="text-sol-green">✓</span> Anonymously verified via Opaque ZK attestation
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full rounded-lg border border-ink-700 hover:border-ink-500 bg-ink-800 hover:bg-ink-700 text-sm text-ink-400 hover:text-mist py-2.5 transition-colors"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-ink-700 px-6 py-3 flex items-center justify-between">
        <p className="text-xs text-ink-600">Proofs verified client-side · Nullifiers stored in localStorage</p>
        <p className="text-xs text-ink-600">Opaque Protocol</p>
      </footer>
    </div>
  );
}
