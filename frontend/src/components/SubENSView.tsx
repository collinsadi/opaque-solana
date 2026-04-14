import { useState } from "react";
import { useToast } from "../context/ToastContext";

type SubENSViewProps = {
  onBack: () => void;
};

const SUBENS_STORAGE_KEY = "opaque-subens-name";

function getStoredName(): string | null {
  try {
    return localStorage.getItem(SUBENS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredName(name: string) {
  try {
    localStorage.setItem(SUBENS_STORAGE_KEY, name);
  } catch {
    // ignore
  }
}

export function SubENSView({ onBack }: SubENSViewProps) {
  const [input, setInput] = useState(getStoredName() ?? "");
  const { showToast } = useToast();

  const handleClaim = () => {
    const name = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!name) {
      showToast("Enter a name.");
      return;
    }
    setStoredName(name);
    showToast(`Success! ${name}.opaque.eth is yours.`);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-white mb-1">Setup Sub-ENS</h2>
      <p className="text-sm text-neutral-500 mb-6">
        Claim your [name].opaque.eth identity (simulated).
      </p>
      <div className="mb-4">
        <label className="block text-sm text-neutral-500 mb-1.5">Name</label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="yourname"
          className="input-field"
        />
        {input.trim() && (
          <p className="mt-1.5 text-neutral-500 text-xs font-mono">
            → {input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "…"}.opaque.eth
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClaim}
          className="py-2.5 px-4 rounded-lg text-sm font-medium btn-primary"
        >
          Claim Name
        </button>
        <button
          type="button"
          onClick={onBack}
          className="py-2.5 px-4 rounded-lg text-sm btn-secondary"
        >
          Back
        </button>
      </div>
    </div>
  );
}
