pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/*
 * AgeAbove18
 * ----------
 * Proves: "I know a birth timestamp that (a) hashes to the commitment the
 * issuer put in my credential, and (b) is at least 18 years before now."
 *
 * WITHOUT revealing the birth timestamp.
 *
 * PRIVATE inputs (the prover knows, the verifier never sees):
 *   birthTimestamp — unix seconds of date of birth
 *   salt           — random value so the commitment can't be brute-forced.
 *                    Without it, an attacker could hash all 40,000 plausible
 *                    birth dates and match the commitment. This is the detail
 *                    panels ask about, so understand it.
 *
 * PUBLIC inputs (both sides see):
 *   currentTimestamp — the verifier supplies this, so the prover cannot lie
 *                      about what "now" is
 *   commitment       — Poseidon(birthTimestamp, salt), issued inside the
 *                      credential and signed by the university
 *
 * Poseidon rather than keccak: it is ZK-friendly and costs far fewer
 * constraints inside a circuit.
 */
template AgeAbove(thresholdSeconds) {
    signal input birthTimestamp;
    signal input salt;
    signal input currentTimestamp;
    signal input commitment;

    // (a) the birth timestamp really is the one the issuer committed to
    component hasher = Poseidon(2);
    hasher.inputs[0] <== birthTimestamp;
    hasher.inputs[1] <== salt;
    hasher.out === commitment;

    // (b) enough time has passed
    component gte = GreaterEqThan(64);
    gte.in[0] <== currentTimestamp - birthTimestamp;
    gte.in[1] <== thresholdSeconds;

    // constrain to 1, so a proof simply cannot be produced for an under-18
    gte.out === 1;
}

// 18 years = 18 * 365.25 * 24 * 60 * 60 = 568036800 seconds
component main {public [currentTimestamp, commitment]} = AgeAbove(568036800);
