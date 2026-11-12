// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CredentialRegistry.sol";
import "./IssuerRegistry.sol";

/**
 * @title VerificationRegistry
 * @notice Where a verifier checks a credential presentation.
 *
 * FOUR CHECKS, in the order the panel will ask about them:
 *   1. Proof of possession — the holder signed this specific request, so a
 *      stolen credential id is useless without the holder's private key.
 *   2. Subject binding — the signer IS the subject named in the credential.
 *   3. Issuer trust — the issuer is still an active recognised institution.
 *   4. Status — the credential is neither expired nor revoked.
 *
 * Replay protection: each (holder, verifier) pair has a nonce, and every
 * presentation carries a deadline. A presentation captured off the wire
 * cannot be replayed at a different verifier or after it expires.
 */
contract VerificationRegistry is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant PRESENTATION_TYPEHASH =
        keccak256(
            "Presentation(bytes32 credentialId,address verifier,uint256 nonce,uint256 deadline)"
        );

    CredentialRegistry public immutable credentialRegistry;
    IssuerRegistry public immutable issuerRegistry;

    /// holder => verifier => next expected nonce
    mapping(address => mapping(address => uint256)) public nonces;

    /// running count of successful verifications, for your benchmark slide
    uint256 public totalVerifications;

    event VerificationSucceeded(
        bytes32 indexed credentialId,
        address indexed holder,
        address indexed verifier,
        bytes32 schemaId,
        uint64 timestamp
    );

    event VerificationFailed(
        bytes32 indexed credentialId,
        address indexed verifier,
        string reason
    );

    error PresentationExpired(uint256 deadline, uint256 nowTs);
    error BadSignature(address recovered, address expected);
    error IssuerNotTrusted(address issuer);
    error CredentialNotValid(CredentialRegistry.Status status);
    error WrongSchema(bytes32 expected, bytes32 got);

    constructor(address credentialRegistryAddress, address issuerRegistryAddress)
        EIP712("DIVS-Presentation", "1")
    {
        credentialRegistry = CredentialRegistry(credentialRegistryAddress);
        issuerRegistry = IssuerRegistry(issuerRegistryAddress);
    }

    /// @notice Hash a presentation for off-chain signing (used by the wallet).
    function hashPresentation(
        bytes32 credentialId,
        address verifier,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        PRESENTATION_TYPEHASH,
                        credentialId,
                        verifier,
                        nonce,
                        deadline
                    )
                )
            );
    }

    /**
     * @notice Read-only check. Use this from a dApp before spending gas.
     * @return ok      whether the presentation would pass
     * @return reason  empty if ok, otherwise why it failed
     */
    function checkPresentation(
        bytes32 credentialId,
        address holder,
        uint256 deadline,
        bytes calldata signature
    ) public view returns (bool ok, string memory reason) {
        if (block.timestamp > deadline) return (false, "presentation expired");

        CredentialRegistry.Status status = credentialRegistry.statusOf(credentialId);
        if (status == CredentialRegistry.Status.Unknown) return (false, "unknown credential");
        if (status == CredentialRegistry.Status.Revoked) return (false, "credential revoked");
        if (status == CredentialRegistry.Status.Expired) return (false, "credential expired");

        CredentialRegistry.Credential memory c =
            credentialRegistry.getCredential(credentialId);

        if (c.subject != holder) return (false, "holder is not the subject");
        if (!issuerRegistry.isActiveIssuer(c.issuer)) return (false, "issuer not trusted");

        bytes32 digest = hashPresentation(
            credentialId,
            msg.sender,
            nonces[holder][msg.sender],
            deadline
        );
        address recovered = digest.recover(signature);
        if (recovered != holder) return (false, "bad signature");

        return (true, "");
    }

    /**
     * @notice Full verification. Consumes the nonce and emits an audit event.
     * @param expectedSchemaId pass bytes32(0) to accept any schema
     */
    function verifyPresentation(
        bytes32 credentialId,
        address holder,
        uint256 deadline,
        bytes32 expectedSchemaId,
        bytes calldata signature
    ) external returns (bool) {
        if (block.timestamp > deadline) {
            revert PresentationExpired(deadline, block.timestamp);
        }

        CredentialRegistry.Status status = credentialRegistry.statusOf(credentialId);
        if (status != CredentialRegistry.Status.Valid) {
            emit VerificationFailed(credentialId, msg.sender, "status not valid");
            revert CredentialNotValid(status);
        }

        CredentialRegistry.Credential memory c =
            credentialRegistry.getCredential(credentialId);

        if (expectedSchemaId != bytes32(0) && c.schemaId != expectedSchemaId) {
            revert WrongSchema(expectedSchemaId, c.schemaId);
        }
        if (!issuerRegistry.isActiveIssuer(c.issuer)) {
            revert IssuerNotTrusted(c.issuer);
        }

        uint256 nonce = nonces[holder][msg.sender];
        bytes32 digest = hashPresentation(credentialId, msg.sender, nonce, deadline);
        address recovered = digest.recover(signature);
        if (recovered != holder || c.subject != holder) {
            revert BadSignature(recovered, c.subject);
        }

        nonces[holder][msg.sender] = nonce + 1;
        totalVerifications += 1;

        emit VerificationSucceeded(
            credentialId,
            holder,
            msg.sender,
            c.schemaId,
            uint64(block.timestamp)
        );
        return true;
    }
}
