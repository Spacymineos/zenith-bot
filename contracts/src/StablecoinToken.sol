// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title StablecoinToken — mintable/burnable ERC-20 for Zenith synthetic assets
/// @dev Only VAULT_ROLE can mint or burn; used for sUSD, sEUR, sGOLD, sBTC
contract StablecoinToken is ERC20, AccessControl {
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // ── Events ───────────────────────────────────────────────────────────────
    event Minted(address indexed to, uint256 amount, uint256 timestamp);
    event Burned(address indexed from, uint256 amount, uint256 timestamp);

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(
        string memory name_,
        string memory symbol_,
        address admin
    ) ERC20(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        // Admin can grant VAULT_ROLE to the VaultManager after deploy
    }

    // ── VAULT Functions ───────────────────────────────────────────────────────

    function mint(address to, uint256 amount) external onlyRole(VAULT_ROLE) {
        _mint(to, amount);
        emit Minted(to, amount, block.timestamp);
    }

    function burn(address from, uint256 amount) external onlyRole(VAULT_ROLE) {
        _burn(from, amount);
        emit Burned(from, amount, block.timestamp);
    }
}
