// Static copy describing the protocol mechanism — shared between the
// homepage teaser and the full /protocol explainer so the two never drift
// out of sync with each other.

export interface ProtocolStep {
  index: string;
  title: string;
  body: string;
}

export const ENFORCEMENT_TABLE: { enforced: string; clientVerified: string }[] = [
  { enforced: "Pledge membership (Merkle path + leaf binding)", clientVerified: "Registry's core address actually hosts the claimed Core instance" },
  { enforced: "Nullifier uniqueness — one pledge per identity per quorum", clientVerified: "Registry's config commitment matches Core's own config_commitment" },
  { enforced: "Threshold transition and exactly-once consequence firing", clientVerified: "A claim refers to a Core instance that actually fired" },
  { enforced: "Issuer / operator / arbiter shared-secret authorization", clientVerified: "External, real-world settlement of a claimed consequence" },
  { enforced: "Recipient-secret ownership for a claim", clientVerified: "Whether a quorum's threshold was reached “for a good reason”" }
];

export const PRIOR_ART = [
  {
    name: "Semaphore",
    note: "Anonymous, issuer-unlinkable group signaling. The identity layer adopts this pattern — it does not invent it."
  },
  {
    name: "Dominant assurance contracts (Tabarrok, 1998)",
    note: "The economic mechanism — a threshold that must be reached before any consequence executes — is decades old, popularized since by Kickstarter-style crowdfunding."
  },
  {
    name: "What is actually new",
    note: "The atomic, same-transaction composition of both: identity-hiding pledges and threshold-triggered consequence in one circuit call, with no coordinator and no separate execution step to race or censor."
  }
];

export const PROTOCOL_STEPS: ProtocolStep[] = [
  {
    index: "01",
    title: "Eligibility",
    body: "An issuer registers a participant's identity commitment — a hash the participant generated locally. The secret behind it never touches the ledger."
  },
  {
    index: "02",
    title: "Private Pledge",
    body: "The participant proves, with a Merkle path, that their commitment belongs to the eligible set — without revealing which commitment is theirs."
  },
  {
    index: "03",
    title: "Nullifier",
    body: "A nullifier, domain-separated by organization, quorum, and action, prevents the same identity from pledging twice in this action — without linking it to their commitment."
  },
  {
    index: "04",
    title: "Quorum",
    body: "Each valid pledge increments a public tally. The running count is visible; who cast any individual pledge is not."
  },
  {
    index: "05",
    title: "Ignition",
    body: "The pledge that crosses the threshold fires the consequence — in the very same transaction, the same proof, that counted it. There is no separate execution step to race or censor."
  },
  {
    index: "06",
    title: "Claim",
    body: "The intended recipient can later prove control of a recipient secret to record a claim. The Claim Ledger cannot verify the referenced quorum actually fired — that boundary is enforced by the toolchain, not hidden by the UI."
  }
];
