// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../PredicateVerifier.sol";

/**
 * Test double for the snarkjs-generated verifier, so the surrounding logic can
 * be tested before the trusted setup is done. NEVER deploy this to a network
 * you demo on — it accepts whatever you tell it to.
 */
contract MockGroth16Verifier is IGroth16Verifier {
    bool public shouldAccept = true;

    function setShouldAccept(bool v) external {
        shouldAccept = v;
    }

    function verifyProof(
        uint[2] calldata,
        uint[2][2] calldata,
        uint[2] calldata,
        uint[2] calldata
    ) external view returns (bool) {
        return shouldAccept;
    }
}
