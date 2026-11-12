// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DIDRegistry.sol";

/**
 * @title PairwiseDIDRegistry
 * @notice Reduces cross-verifier correlation by letting one holder present a
 *         DIFFERENT identity address to each verifier.
 *
 * WHY THIS EXISTS — read this before your review.
 *
 * Liu et al. (WWW '25) identify that primary DID solutions, W3C DID included,
 * "cannot resist the link analysis across different services due to the same
 * public key usage." They solve it fully with decentralized anonymous
 * credentials and one-time show tokens, at the cost of a distributed committee
 * and a pairing-based stack.
 *
 * We do not reproduce that machinery. Instead we implement pairwise
 * identifiers: the holder derives a distinct sub-identity per verifier from a
 * single root identity. Verifier A and Verifier B see unrelated addresses and
 * cannot trivially correlate them.
 *
 * HONEST LIMITS OF THIS APPROACH — state these, do not hide them:
 *   1. The LINK IS ON-CHAIN. bindPairwise() publicly records root -> pairwise.
 *      Anyone reading the chain can follow it. What this defeats is a verifier
 *      correlating by address alone; it does not defeat a determined chain
 *      analyst. Full unlinkability needs Liu's DAC construction.
 *   2. Repeated presentations to the SAME verifier remain linkable, which is
 *      usually desired (that verifier needs to recognise a returning user).
 *   3. The issuer still knows the root identity, so anonymity-to-authority is
 *      NOT achieved. That is inherent to our single-issuer trust model.
 *
 * So: this is a partial mitigation and a deliberate trade-off, not a claim to
 * have matched Liu et al.
 */
contract PairwiseDIDRegistry {
    DIDRegistry public immutable didRegistry;

    /// pairwise identity => root identity
    mapping(address => address) public rootOf;

    /// root identity => verifier => pairwise identity
    mapping(address => mapping(address => address)) public pairwiseFor;

    /// root identity => how many pairwise identities exist
    mapping(address => uint256) public pairwiseCount;

    event PairwiseBound(
        address indexed root,
        address indexed verifier,
        address indexed pairwise
    );

    error NotRootController(address caller, address root);
    error PairwiseAlreadyBound(address root, address verifier);
    error PairwiseInUse(address pairwise);

    constructor(address didRegistryAddress) {
        require(didRegistryAddress != address(0), "Pairwise: zero registry");
        didRegistry = DIDRegistry(didRegistryAddress);
    }

    /**
     * @notice Bind a fresh pairwise identity for use with one specific verifier.
     * @dev Callable only by the controller of the root identity. The pairwise
     *      address is generated off-chain by deriving a child key (e.g. BIP-32
     *      style) from the holder's root key.
     */
    function bindPairwise(
        address root,
        address verifier,
        address pairwise
    ) external {
        if (msg.sender != didRegistry.controllerOf(root)) {
            revert NotRootController(msg.sender, root);
        }
        require(pairwise != address(0), "Pairwise: zero pairwise");
        require(verifier != address(0), "Pairwise: zero verifier");
        if (pairwiseFor[root][verifier] != address(0)) {
            revert PairwiseAlreadyBound(root, verifier);
        }
        if (rootOf[pairwise] != address(0)) {
            revert PairwiseInUse(pairwise);
        }

        rootOf[pairwise] = root;
        pairwiseFor[root][verifier] = pairwise;
        pairwiseCount[root] += 1;

        emit PairwiseBound(root, verifier, pairwise);
    }

    /// @notice True if `pairwise` legitimately derives from `root`.
    function isPairwiseOf(address pairwise, address root)
        external
        view
        returns (bool)
    {
        return rootOf[pairwise] == root;
    }

    /// @notice Resolve to the root, or return the address itself if it is a root.
    function resolveRoot(address identity) external view returns (address) {
        address r = rootOf[identity];
        return r == address(0) ? identity : r;
    }
}
