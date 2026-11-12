// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DIDRegistry
 * @notice Minimal ERC-1056 style registry mapping an identity address to its
 *         current controller and public key material.
 *
 * DESIGN NOTES (read before your review):
 *  - The identity itself IS an Ethereum address derived from the holder's key
 *    pair. The DID string is formed off-chain as  did:ethr:<chainId>:<address>.
 *  - NOTHING personal is stored here. Only controller addresses, public keys
 *    and block numbers. This is the whole point: the registry is public.
 *  - `changed[identity]` stores the block number of the last change. A resolver
 *    walks the event log backwards from that block to rebuild the DID Document
 *    at any point in history — which is how a signature made by a key that was
 *    later rotated can still be verified.
 */
contract DIDRegistry {
    /// identity => controller. Zero address means the identity controls itself.
    mapping(address => address) private _controllers;

    /// identity => block number of the most recent change (0 if never changed)
    mapping(address => uint256) public changed;

    /// identity => keccak256(keyId) => revoked-at block (0 = not revoked)
    mapping(address => mapping(bytes32 => uint256)) public revokedKeys;

    event DIDControllerChanged(
        address indexed identity,
        address controller,
        uint256 previousChange
    );

    event DIDAttributeChanged(
        address indexed identity,
        bytes32 indexed name,
        bytes value,
        uint256 validTo,
        uint256 previousChange
    );

    event DIDKeyRevoked(
        address indexed identity,
        bytes32 indexed keyId,
        uint256 previousChange
    );

    error NotController(address caller, address identity);

    modifier onlyController(address identity) {
        if (msg.sender != controllerOf(identity)) {
            revert NotController(msg.sender, identity);
        }
        _;
    }

    /// @notice Current controller of an identity. Self-controlled by default.
    function controllerOf(address identity) public view returns (address) {
        address c = _controllers[identity];
        return c == address(0) ? identity : c;
    }

    /// @notice Transfer control of an identity (key rotation / recovery).
    function changeController(address identity, address newController)
        external
        onlyController(identity)
    {
        require(newController != address(0), "DIDRegistry: zero controller");
        _controllers[identity] = newController;
        emit DIDControllerChanged(identity, newController, changed[identity]);
        changed[identity] = block.number;
    }

    /**
     * @notice Publish an attribute of the DID Document.
     * @param name  e.g. keccak256("did/pub/Secp256k1/veriKey/hex")
     * @param value the public key bytes or service endpoint
     * @param validity seconds from now for which the attribute is valid
     *
     * Attributes are stored ONLY in the event log, never in contract storage —
     * this is deliberate and keeps gas low. The resolver reconstructs the
     * document from logs.
     */
    function setAttribute(
        address identity,
        bytes32 name,
        bytes calldata value,
        uint256 validity
    ) external onlyController(identity) {
        emit DIDAttributeChanged(
            identity,
            name,
            value,
            block.timestamp + validity,
            changed[identity]
        );
        changed[identity] = block.number;
    }

    /// @notice Revoke a specific key so future signatures from it are rejected.
    function revokeKey(address identity, bytes32 keyId)
        external
        onlyController(identity)
    {
        require(revokedKeys[identity][keyId] == 0, "DIDRegistry: already revoked");
        revokedKeys[identity][keyId] = block.number;
        emit DIDKeyRevoked(identity, keyId, changed[identity]);
        changed[identity] = block.number;
    }

    /// @notice True if the identity has ever been registered/modified.
    function isRegistered(address identity) external view returns (bool) {
        return changed[identity] != 0;
    }
}
