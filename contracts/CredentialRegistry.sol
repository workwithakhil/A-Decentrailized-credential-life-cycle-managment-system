// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IssuerRegistry.sol";

/**
 * @title CredentialRegistry
 * @notice Anchors verifiable credentials on-chain and tracks their status.
 *
 * WHAT IS STORED ON-CHAIN (this is the slide you will be questioned on):
 *   - credentialId  : keccak256 of the canonical credential JSON. A hash.
 *   - issuer        : the address that issued it
 *   - subject       : the holder's identity address (a public key hash, not a person)
 *   - schemaId      : which credential type this is
 *   - issuedAt / expiresAt / revoked
 *   - encryptedUri  : IPFS CID of the AES-encrypted credential payload
 *
 * WHAT IS NEVER STORED: names, dates of birth, roll numbers, addresses,
 * marks, or any other claim value. Those live only inside the ciphertext,
 * and only the holder has the key.
 */
contract CredentialRegistry {
    enum Status {
        Unknown,   // never issued
        Valid,
        Expired,
        Revoked
    }

    struct Credential {
        address issuer;
        address subject;
        bytes32 schemaId;
        uint64 issuedAt;
        uint64 expiresAt;   // 0 == never expires
        bool revoked;
        string encryptedUri; // ipfs://<cid> of the encrypted payload
    }

    IssuerRegistry public immutable issuerRegistry;

    mapping(bytes32 => Credential) private _credentials;

    /// subject => list of credential ids (convenience for the wallet UI)
    mapping(address => bytes32[]) private _bySubject;

    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed issuer,
        address indexed subject,
        bytes32 schemaId,
        uint64 expiresAt,
        string encryptedUri
    );

    event CredentialRevoked(
        bytes32 indexed credentialId,
        address indexed issuer,
        uint64 revokedAt
    );

    error NotActiveIssuer(address caller);
    error CredentialExists(bytes32 credentialId);
    error CredentialNotFound(bytes32 credentialId);
    error NotCredentialIssuer(address caller, bytes32 credentialId);
    error AlreadyRevoked(bytes32 credentialId);

    constructor(address issuerRegistryAddress) {
        require(issuerRegistryAddress != address(0), "CredentialRegistry: zero registry");
        issuerRegistry = IssuerRegistry(issuerRegistryAddress);
    }

    modifier onlyActiveIssuer() {
        if (!issuerRegistry.isActiveIssuer(msg.sender)) {
            revert NotActiveIssuer(msg.sender);
        }
        _;
    }

    /**
     * @notice Anchor a new credential.
     * @param credentialId keccak256 of the canonical credential JSON
     * @param subject      holder identity address
     * @param schemaId     keccak256 of the schema name, e.g. "StudentCredential"
     * @param expiresAt    unix seconds, or 0 for no expiry
     * @param encryptedUri IPFS URI of the encrypted payload
     */
    function issueCredential(
        bytes32 credentialId,
        address subject,
        bytes32 schemaId,
        uint64 expiresAt,
        string calldata encryptedUri
    ) external onlyActiveIssuer {
        if (_credentials[credentialId].issuedAt != 0) {
            revert CredentialExists(credentialId);
        }
        require(subject != address(0), "CredentialRegistry: zero subject");
        require(
            expiresAt == 0 || expiresAt > block.timestamp,
            "CredentialRegistry: expiry in the past"
        );

        _credentials[credentialId] = Credential({
            issuer: msg.sender,
            subject: subject,
            schemaId: schemaId,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false,
            encryptedUri: encryptedUri
        });
        _bySubject[subject].push(credentialId);

        emit CredentialIssued(
            credentialId,
            msg.sender,
            subject,
            schemaId,
            expiresAt,
            encryptedUri
        );
    }

    /// @notice Only the original issuer may revoke.
    function revokeCredential(bytes32 credentialId) external {
        Credential storage c = _credentials[credentialId];
        if (c.issuedAt == 0) revert CredentialNotFound(credentialId);
        if (c.issuer != msg.sender) {
            revert NotCredentialIssuer(msg.sender, credentialId);
        }
        if (c.revoked) revert AlreadyRevoked(credentialId);

        c.revoked = true;
        emit CredentialRevoked(credentialId, msg.sender, uint64(block.timestamp));
    }

    /// @notice The single source of truth used by the verifier.
    function statusOf(bytes32 credentialId) public view returns (Status) {
        Credential storage c = _credentials[credentialId];
        if (c.issuedAt == 0) return Status.Unknown;
        if (c.revoked) return Status.Revoked;
        if (c.expiresAt != 0 && block.timestamp > c.expiresAt) {
            return Status.Expired;
        }
        return Status.Valid;
    }

    function getCredential(bytes32 credentialId)
        external
        view
        returns (Credential memory)
    {
        Credential memory c = _credentials[credentialId];
        if (c.issuedAt == 0) revert CredentialNotFound(credentialId);
        return c;
    }

    function credentialsOf(address subject)
        external
        view
        returns (bytes32[] memory)
    {
        return _bySubject[subject];
    }
}
