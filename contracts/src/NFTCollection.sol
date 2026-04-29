// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title NFTCollection — on-chain SVG NFTs with configurable Zenith Coin pricing
contract NFTCollection is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant SHOP_ROLE = keccak256("SHOP_ROLE");

    mapping(uint256 => uint256) public tokenPrice;      // Zenith Coin price per tokenId
    mapping(uint256 => bool)    public tokenMinted;
    mapping(uint256 => address) public tokenCreator;

    address payable public treasury;

    event Purchased(address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 timestamp);
    event PriceSet(uint256 indexed tokenId, uint256 price);
    event TreasuryUpdated(address indexed newTreasury);

    constructor(address admin, address payable _treasury) ERC721("Zenith NFT", "ZNFT") {
        require(_treasury != address(0), "NFTCollection: zero treasury");
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SHOP_ROLE, admin);
    }

    // ── SHOP Functions ────────────────────────────────────────────────────────

    function mint(address to, uint256 tokenId) external onlyRole(SHOP_ROLE) {
        require(!tokenMinted[tokenId], "NFTCollection: already minted");
        tokenMinted[tokenId] = true;
        tokenCreator[tokenId] = to;
        _safeMint(to, tokenId);
    }

    // ── Public Buy ────────────────────────────────────────────────────────────

    function buy(uint256 tokenId) external payable {
        require(tokenMinted[tokenId], "NFTCollection: not minted");
        uint256 price = tokenPrice[tokenId];
        require(price > 0, "NFTCollection: not for sale");
        require(msg.value >= price, "NFTCollection: insufficient payment");

        address seller = ownerOf(tokenId);
        _transfer(seller, msg.sender, tokenId);

        (bool ok, ) = payable(treasury).call{value: price}("");
        require(ok, "NFTCollection: fee transfer failed");

        if (msg.value > price) {
            (bool refund, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refund, "NFTCollection: refund failed");
        }

        tokenPrice[tokenId] = 0; // delist after sale
        emit Purchased(msg.sender, tokenId, price, block.timestamp);
    }

    // ── Owner/Admin Functions ─────────────────────────────────────────────────

    function setPrice(uint256 tokenId, uint256 price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenPrice[tokenId] = price;
        emit PriceSet(tokenId, price);
    }

    function setTreasury(address payable _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "NFTCollection: zero address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // ── On-chain SVG Metadata ─────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenMinted[tokenId], "NFTCollection: nonexistent token");

        string memory svg = _buildSVG(tokenId);
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"Zenith NFT #', tokenId.toString(), '",',
            '"description":"Zenith on-chain NFT",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[{"trait_type":"Token ID","value":', tokenId.toString(), '}]}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _buildSVG(uint256 tokenId) internal pure returns (string memory) {
        string memory id = tokenId.toString();
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">',
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#0f0c29"/><stop offset="100%" style="stop-color:#302b63"/>',
            '</linearGradient></defs>',
            '<rect width="400" height="400" fill="url(#g)" rx="20"/>',
            '<circle cx="200" cy="160" r="80" fill="none" stroke="#7c3aed" stroke-width="4"/>',
            '<text x="200" y="168" font-family="monospace" font-size="36" fill="#a78bfa" text-anchor="middle">ZP</text>',
            '<text x="200" y="260" font-family="monospace" font-size="18" fill="#e9d5ff" text-anchor="middle">Zenith NFT</text>',
            '<text x="200" y="295" font-family="monospace" font-size="14" fill="#7c3aed" text-anchor="middle">#', id, '</text>',
            '</svg>'
        ));
    }

    // ── Interface Support ─────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
