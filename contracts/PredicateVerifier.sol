// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CredentialRegistry.sol";
import "./IssuerRegistry.sol";

/// Interface of the verifier contract that snarkjs generates for you.
/// Do not write this by hand — see circuits/README.md for the command.
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[2] calldata publicSignals
    ) external view returns (bool);
}

/**
 * @title PredicateVerifier
 * @notice Age-gated access without ever learning the date of birth.
 *
 * The chain of trust, which is the thing to explain in the review:
 *
 *   1. The university signs a credential containing commitment =
 *      Poseidon(dateOfBirth, salt), and anchors it via CredentialRegistry.
 *   2. The student's wallet generates a ZK proof that it knows a birth date
 *      matching that commitment AND that the date is 18+ years ago.
 *   3. This contract checks the proof is valid, that the commitment inside
 *      the proof matches the one bound to the credential, and that the
 *      credential itself is still valid and from a trusted issuer.
 *
 * Step 3 is what stops a student proving 18+ against someone ELSE's
 * commitment: the commitment is pinned to the credential on-chain.
 */
contract PredicateVerifier {
    IGroth16Verifier public immutable zkVerifier;
    CredentialRegistry public immutable credentialRegistry;
    IssuerRegistry public immutable issuerRegistry;

    /// credentialId => the age commitment bound to it by the issuer
    mapping(bytes32 => uint256) public commitmentOf;

    /// how far the supplied currentTimestamp may drift from block time
    uint256 public constant MAX_CLOCK_DRIFT = 15 minutes;

    event CommitmentBound(bytes32 indexed credentialId, uint256 commitment);
    event PredicateProved(
        bytes32 indexed credentialId,
        address indexed verifier,
        string predicate
    );

    error NotCredentialIssuer();
    error CommitmentAlreadyBound();
    error NoCommitmentBound();
    error CommitmentMismatch(uint256 expected, uint256 got);
    error StaleTimestamp(uint256 supplied, uint256 blockTime);
    error CredentialNotValid();
    error InvalidProof();

    constructor(
        address zkVerifierAddress,
        address credentialRegistryAddress,
        address issuerRegistryAddress
    ) {
        zkVerifier = IGroth16Verifier(zkVerifierAddress);
        credentialRegistry = CredentialRegistry(credentialRegistryAddress);
        issuerRegistry = IssuerRegistry(issuerRegistryAddress);
    }

    /// @notice The issuer binds an age commitment to a credential it issued.
    function bindCommitment(bytes32 credentialId, uint256 commitment) external {
        CredentialRegistry.Credential memory c =
            credentialRegistry.getCredential(credentialId);
        if (c.issuer != msg.sender) revert NotCredentialIssuer();
        if (commitmentOf[credentialId] != 0) revert CommitmentAlreadyBound();

        commitmentOf[credentialId] = commitment;
        emit CommitmentBound(credentialId, commitment);
    }

    /**
     * @notice Prove the subject of `credentialId` is at least 18.
     * @param publicSignals [currentTimestamp, commitment] — must match the
     *        order declared in the circuit's `main` component.
     */
    function proveAgeAbove18(
        bytes32 credentialId,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[2] calldata publicSignals
    ) external returns (bool) {
        uint256 suppliedTime = publicSignals[0];
        uint256 suppliedCommitment = publicSignals[1];

        // The prover cannot claim it is the year 2099 to age themselves up.
        if (
            suppliedTime > block.timestamp + MAX_CLOCK_DRIFT ||
            suppliedTime + MAX_CLOCK_DRIFT < block.timestamp
        ) {
            revert StaleTimestamp(suppliedTime, block.timestamp);
        }

        uint256 bound = commitmentOf[credentialId];
        if (bound == 0) revert NoCommitmentBound();
        if (bound != suppliedCommitment) {
            revert CommitmentMismatch(bound, suppliedCommitment);
        }

        if (
            credentialRegistry.statusOf(credentialId) !=
            CredentialRegistry.Status.Valid
        ) {
            revert CredentialNotValid();
        }

        CredentialRegistry.Credential memory cred =
            credentialRegistry.getCredential(credentialId);
        if (!issuerRegistry.isActiveIssuer(cred.issuer)) {
            revert CredentialNotValid();
        }

        if (!zkVerifier.verifyProof(a, b, c, publicSignals)) {
            revert InvalidProof();
        }

        emit PredicateProved(credentialId, msg.sender, "age >= 18");
        return true;
    }
}
