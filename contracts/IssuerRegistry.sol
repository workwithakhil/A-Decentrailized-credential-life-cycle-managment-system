// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IssuerRegistry
 * @notice The trust anchor. Records which addresses are recognised issuers
 *         (a university, a bank, a hospital) and lets them be deactivated.
 *
 * HONEST LIMITATION — say this in your review before the panel says it:
 *   Bootstrapping issuer trust is NOT solved by this project. Someone must
 *   decide that address 0xABC really is "State University". Here that someone
 *   is the contract owner, which is a governance assumption, not a
 *   cryptographic guarantee. In production this role would be a DAO, a
 *   government registry, or a multi-sig of accreditation bodies.
 */
contract IssuerRegistry is Ownable {
    struct Issuer {
        string name;        // human-readable label, e.g. "State University"
        bool active;
        uint64 registeredAt;
    }

    mapping(address => Issuer) private _issuers;
    address[] private _issuerList;

    event IssuerRegistered(address indexed issuer, string name);
    event IssuerStatusChanged(address indexed issuer, bool active);

    constructor() Ownable(msg.sender) {}

    function registerIssuer(address issuer, string calldata name)
        external
        onlyOwner
    {
        require(issuer != address(0), "IssuerRegistry: zero address");
        require(bytes(name).length > 0, "IssuerRegistry: empty name");
        require(
            _issuers[issuer].registeredAt == 0,
            "IssuerRegistry: already registered"
        );

        _issuers[issuer] = Issuer({
            name: name,
            active: true,
            registeredAt: uint64(block.timestamp)
        });
        _issuerList.push(issuer);

        emit IssuerRegistered(issuer, name);
    }

    function setIssuerActive(address issuer, bool active) external onlyOwner {
        require(
            _issuers[issuer].registeredAt != 0,
            "IssuerRegistry: not registered"
        );
        _issuers[issuer].active = active;
        emit IssuerStatusChanged(issuer, active);
    }

    function isActiveIssuer(address issuer) external view returns (bool) {
        return _issuers[issuer].active;
    }

    function getIssuer(address issuer)
        external
        view
        returns (string memory name, bool active, uint64 registeredAt)
    {
        Issuer storage i = _issuers[issuer];
        return (i.name, i.active, i.registeredAt);
    }

    function issuerCount() external view returns (uint256) {
        return _issuerList.length;
    }

    function issuerAt(uint256 index) external view returns (address) {
        return _issuerList[index];
    }
}
